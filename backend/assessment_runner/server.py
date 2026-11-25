"""Dedicated grader container. No application secrets, source mounts or database access."""
import hmac
import json
import os
import signal
import subprocess
import sys
import tempfile
import threading
import resource
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LIMIT = threading.BoundedSemaphore(2)
# Only candidate code/arguments enter the child. Expected answers stay in the supervisor.
CHILD = r'''
import ctypes, json, sys, resource
lib = ctypes.CDLL('libseccomp.so.2')
lib.seccomp_init.restype = ctypes.c_void_p
lib.seccomp_init.argtypes = [ctypes.c_uint32]
lib.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
lib.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
lib.seccomp_load.argtypes = [ctypes.c_void_p]
ctx = lib.seccomp_init(0x7fff0000)
if not ctx: sys.exit(90)
for name in ('socket','socketpair','clone','clone3','fork','vfork','ptrace','kill','tkill','tgkill','process_vm_readv','process_vm_writev'):
    number = lib.seccomp_syscall_resolve_name(name.encode())
    if number >= 0 and lib.seccomp_rule_add(ctx, 0x00050001, number, 0) != 0: sys.exit(90)
if lib.seccomp_load(ctx) != 0: sys.exit(90)
payload = json.loads(sys.stdin.read())
namespace = {}
exec(compile(payload['code'], '<answer>', 'exec'), namespace)
value = namespace[payload['function_name']](*payload['args'])
print('\nCODORA_VALUE:' + json.dumps(value, allow_nan=False))
'''


def restrict():
    resource.setrlimit(resource.RLIMIT_CPU, (2, 2))
    resource.setrlimit(resource.RLIMIT_AS, (128 * 1024 * 1024, 128 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_FSIZE, (65536, 65536))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    os.setgroups([])
    os.setgid(65534)
    os.setuid(65534)


def grade(data):
    tests = data['tests']
    if not isinstance(tests, list) or not 1 <= len(tests) <= 8 or len(data['code']) > 20000:
        raise ValueError('Invalid grading request')
    passed = 0
    for case in tests:
        with tempfile.TemporaryFile() as out, tempfile.TemporaryFile() as err:
            process = subprocess.Popen([sys.executable, '-I', '-c', CHILD], stdin=subprocess.PIPE,
                stdout=out, stderr=err, env={}, cwd='/tmp', preexec_fn=restrict, start_new_session=True)
            try:
                process.communicate(json.dumps({'code': data['code'], 'function_name': data['function_name'], 'args': case['args']}).encode(), timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            out.seek(0)
            raw = out.read(65536).decode('utf-8', errors='replace')
            try:
                value = json.loads(raw.rsplit('\nCODORA_VALUE:', 1)[1].strip())
                passed += process.returncode == 0 and value == case['expected']
            except (ValueError, IndexError):
                pass
    return {'passed': passed, 'total': len(tests)}


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        token = os.environ.get('ASSESSMENT_RUNNER_TOKEN', '')
        if not token or not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + token):
            self.send_error(401)
            return
        if self.path != '/grade':
            self.send_error(404)
            return
        length = int(self.headers.get('Content-Length', '0'))
        if not 0 < length <= 200000:
            self.send_error(413)
            return
        if not LIMIT.acquire(blocking=False):
            self.send_error(503)
            return
        try:
            result = grade(json.loads(self.rfile.read(length)))
            body = json.dumps(result).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (ValueError, KeyError, TypeError):
            self.send_error(422)
        finally:
            LIMIT.release()

    def log_message(self, *_args):
        pass


ThreadingHTTPServer(('0.0.0.0', 3002), Handler).serve_forever()
