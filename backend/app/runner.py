import json
import subprocess
import sys
import time
from typing import Any


RUNNER_HARNESS = r"""
import json
import sys
import time

# --- User Code ---
{user_code}

# --- Codora Test Harness ---
def _normalize(val):
    v = str(val).strip()
    if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
        return v[1:-1]
    return v

test_cases = json.loads(r'''{test_cases_json}''')
results = []

for tc in test_cases:
    case_id = tc.get("id", "")
    label = tc.get("label", "")
    args_expr = tc.get("argsExpression", "")
    expected = str(tc.get("expectedOutput", "")).strip()
    is_hidden = tc.get("is_hidden", False)

    start_t = time.perf_counter()
    try:
        # Evaluate arguments
        args = eval(args_expr)
        if isinstance(args, tuple):
            actual_val = {function_name}(*args)
        else:
            actual_val = {function_name}(args)

        elapsed = round((time.perf_counter() - start_t) * 1000, 2)
        actual_str = repr(actual_val)
        passed = _normalize(actual_str) == _normalize(expected)

        results.append({
            "case_id": case_id,
            "label": label,
            "passed": passed,
            "actual": actual_str,
            "expected": expected,
            "execution_time_ms": elapsed,
            "is_hidden": is_hidden
        })

        if not passed:
            break  # Stop on first failure like LeetCode
    except Exception as exc:
        elapsed = round((time.perf_counter() - start_t) * 1000, 2)
        results.append({
            "case_id": case_id,
            "label": label,
            "passed": False,
            "error": f"{type(exc).__name__}: {exc}",
            "execution_time_ms": elapsed,
            "is_hidden": is_hidden
        })
        break

print("---CODORA_RESULT_START---")
print(json.dumps(results))
"""


def run_code_sandbox(
    user_code: str,
    function_name: str,
    test_cases: list[dict[str, Any]],
    timeout_seconds: float = 3.0,
) -> dict[str, Any]:
    """
    Executes student code in an isolated Python process with a strict timeout.
    Returns LeetCode-style status:
    - 'Accepted'
    - 'Wrong Answer'
    - 'Time Limit Exceeded'
    - 'Runtime Error'
    - 'Syntax Error'
    """
    # 1. Basic pre-validation: check for dangerous imports/calls
    disallowed = ["os.system", "shutil.rmtree", "subprocess", "pty.spawn"]
    for danger in disallowed:
        if danger in user_code:
            return {
                "status": "Runtime Error",
                "passed_count": 0,
                "total_count": len(test_cases),
                "runtime_ms": 0,
                "error": f"Security violation: call to '{danger}' is not permitted.",
                "failed_case": None,
            }

    # 2. Prepare script payload
    script = RUNNER_HARNESS.replace("{user_code}", user_code)
    script = script.replace("{function_name}", function_name)
    script = script.replace("{test_cases_json}", json.dumps(test_cases))

    # 3. Execute in isolated subprocess with timeout
    start_total = time.perf_counter()
    try:
        proc = subprocess.run(
            [sys.executable, "-I", "-s", "-c", script],
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired:
        return {
            "status": "Time Limit Exceeded",
            "passed_count": 0,
            "total_count": len(test_cases),
            "runtime_ms": round(timeout_seconds * 1000),
            "error": f"Time Limit Exceeded: code execution exceeded {timeout_seconds}s limit. Check for infinite loops.",
            "failed_case": None,
        }

    total_runtime_ms = round((time.perf_counter() - start_total) * 1000, 2)

    # 4. Check for syntax errors or non-zero exit code
    if proc.returncode != 0:
        raw_err = proc.stderr.strip()
        # Clean traceback to give the user the most informative line
        lines = [line for line in raw_err.split("\n") if line.strip()]
        last_error = lines[-1] if lines else "Unknown runtime error"
        status = "Syntax Error" if "SyntaxError" in raw_err else "Runtime Error"
        return {
            "status": status,
            "passed_count": 0,
            "total_count": len(test_cases),
            "runtime_ms": total_runtime_ms,
            "error": last_error,
            "failed_case": None,
        }

    # 5. Parse test results
    output = proc.stdout
    if "---CODORA_RESULT_START---" not in output:
        return {
            "status": "Runtime Error",
            "passed_count": 0,
            "total_count": len(test_cases),
            "runtime_ms": total_runtime_ms,
            "error": "No output produced from runner harness.",
            "failed_case": None,
        }

    json_str = output.split("---CODORA_RESULT_START---")[1].strip()
    try:
        results = json.loads(json_str)
    except Exception as parse_exc:
        return {
            "status": "Runtime Error",
            "passed_count": 0,
            "total_count": len(test_cases),
            "runtime_ms": total_runtime_ms,
            "error": f"Failed to parse test results: {parse_exc}",
            "failed_case": None,
        }

    passed_count = sum(1 for r in results if r.get("passed"))
    total_count = len(test_cases)

    # All passed!
    if passed_count == total_count:
        return {
            "status": "Accepted",
            "passed_count": passed_count,
            "total_count": total_count,
            "runtime_ms": total_runtime_ms,
            "error": None,
            "failed_case": None,
        }

    # Find the first failing case
    failed = next((r for r in results if not r.get("passed")), None)
    if not failed:
        return {
            "status": "Wrong Answer",
            "passed_count": passed_count,
            "total_count": total_count,
            "runtime_ms": total_runtime_ms,
            "error": None,
            "failed_case": None,
        }

    # Hide actual/expected if the case is secret/hidden to avoid leaking test data
    failed_info = {
        "case_id": failed.get("case_id"),
        "label": failed.get("label"),
        "is_hidden": failed.get("is_hidden", False),
        "error": failed.get("error"),
    }
    if not failed.get("is_hidden"):
        failed_info["actual"] = failed.get("actual")
        failed_info["expected"] = failed.get("expected")

    status = "Runtime Error" if failed.get("error") else "Wrong Answer"
    return {
        "status": status,
        "passed_count": passed_count,
        "total_count": total_count,
        "runtime_ms": total_runtime_ms,
        "error": failed.get("error"),
        "failed_case": failed_info,
    }
