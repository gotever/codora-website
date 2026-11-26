"""Edge-case and security tests for app/runner.py (the grader behind POST /api/exercises/{id}/submit).

Every probe is harmless: it only runs `echo`, reads a sentinel environment variable set by the
test itself, or prints text. Tests that assert the *secure* behaviour the runner does not have yet
are xfail(strict=True) with their bug ID from docs/testing/, so they start failing loudly once fixed.
"""
import json

import pytest

from app.runner import run_code_sandbox

SQUARE_CASES = [
    {"id": "visible-1", "label": "Case 1", "argsExpression": "(2,)", "expectedOutput": "4", "is_hidden": False},
    {"id": "hidden-1", "label": "Hidden", "argsExpression": "(7,)", "expectedOutput": "49", "is_hidden": True},
]
SOLUTION = "def square(x):\n    return x * x"


def run(code, cases=SQUARE_CASES, function_name="square", **kwargs):
    return run_code_sandbox(code, function_name, cases, **kwargs)


def case(args, expected, hidden=False, case_id=None):
    return {"id": case_id or f"c-{args}", "label": "", "argsExpression": args, "expectedOutput": expected, "is_hidden": hidden}


# ---------------------------------------------------------------------------
# Correct grading
# ---------------------------------------------------------------------------

def test_reference_solution_is_accepted():
    result = run(SOLUTION)
    assert result["status"] == "Accepted"
    assert (result["passed_count"], result["total_count"]) == (2, 2)
    assert result["error"] is None and result["failed_case"] is None


def test_multiple_arguments_are_unpacked_from_tuple():
    result = run("def add(a, b):\n    return a + b", [case("(2, 3)", "5")], function_name="add")
    assert result["status"] == "Accepted"


def test_single_non_tuple_argument_is_passed_as_is():
    result = run("def length(items):\n    return len(items)", [case("[1, 2, 3]", "3")], function_name="length")
    assert result["status"] == "Accepted"


@pytest.mark.parametrize("code,expected", [
    ("def f(x):\n    return [x, x]", "[1, 1]"),
    ("def f(x):\n    return {'k': x}", "{'k': 1}"),
    ("def f(x):\n    return None", "None"),
    ("def f(x):\n    return 'xin chào'", "xin chào"),
    ("def f(x):\n    return 'quoted'", "'quoted'"),
    ("def f(x):\n    return True", "True"),
    ("def f(x):\n    return 0.5", "0.5"),
])
def test_return_values_are_compared_by_repr(code, expected):
    assert run(code, [case("(1,)", expected)], function_name="f")["status"] == "Accepted"


def test_print_output_from_learner_code_does_not_break_grading():
    code = "print('debug at import')\ndef square(x):\n    print('debug', x)\n    return x * x"
    assert run(code)["status"] == "Accepted"


def test_stops_at_first_failure_and_counts_only_passed_cases():
    cases = [case("(1,)", "1"), case("(2,)", "999"), case("(3,)", "9")]
    result = run(SOLUTION, cases)
    assert result["status"] == "Wrong Answer"
    assert (result["passed_count"], result["total_count"]) == (1, 3)
    assert len(result["case_results"]) == 2  # third case never ran
    assert result["failed_case"]["actual"] == "4" and result["failed_case"]["expected"] == "999"


def test_wrong_function_name_is_runtime_error():
    result = run("def sqr(x):\n    return x * x")
    assert result["status"] == "Runtime Error"
    assert "NameError" in result["error"]


def test_exception_in_visible_case_is_runtime_error_with_details():
    result = run("def square(x):\n    return [][x]")
    assert result["status"] == "Runtime Error"
    assert result["error"].startswith("IndexError")
    assert result["failed_case"]["case_id"] == "visible-1"


def test_deep_recursion_is_runtime_error_not_crash():
    result = run("def square(x):\n    return square(x)")
    assert result["status"] == "Runtime Error"
    assert "RecursionError" in result["error"]


@pytest.mark.parametrize("code", [
    "def square(x)\n    return x",
    "def square(x):\n    return (x",
])
def test_syntax_errors_are_reported_as_syntax_error(code):
    result = run(code)
    assert result["status"] == "Syntax Error"
    assert result["passed_count"] == 0


@pytest.mark.xfail(strict=True, reason="BUG-11: IndentationError/TabError (subclasses of SyntaxError) are reported as 'Runtime Error'")
@pytest.mark.parametrize("code", [
    "def square(x):\nreturn x",
    "def square(x):\n    y = x\n        return y",
])
def test_indentation_errors_are_reported_as_syntax_error(code):
    assert run(code)["status"] == "Syntax Error"


@pytest.mark.xfail(strict=True, reason="BUG-11: the error shown has no learner line number; line numbers that do appear point into the runner harness (learner line + 6)")
def test_syntax_error_line_number_matches_learner_code():
    result = run("x = 1\ny = 2\ndef square(x)\n    return x")
    assert "line 3" in result["error"]


def test_error_at_import_time_is_runtime_error():
    result = run("raise RuntimeError('boom')\ndef square(x):\n    return x * x")
    assert result["status"] == "Runtime Error"
    assert "RuntimeError: boom" in result["error"]


def test_infinite_loop_hits_time_limit_with_configured_timeout():
    result = run("def square(x):\n    while True:\n        pass", timeout_seconds=0.5)
    assert result["status"] == "Time Limit Exceeded"
    assert result["runtime_ms"] == 500
    assert result["passed_count"] == 0


def test_slow_import_time_code_also_hits_time_limit():
    result = run("while True:\n    pass\ndef square(x):\n    return x", timeout_seconds=0.5)
    assert result["status"] == "Time Limit Exceeded"


def test_result_shape_is_stable():
    result = run(SOLUTION)
    assert {"status", "passed_count", "total_count", "runtime_ms", "error", "failed_case", "case_results"} <= set(result)
    assert isinstance(result["runtime_ms"], (int, float)) and result["runtime_ms"] >= 0


# ---------------------------------------------------------------------------
# Hidden test cases are not exposed in the response
# ---------------------------------------------------------------------------

def test_hidden_case_is_not_listed_in_case_results():
    result = run(SOLUTION)
    assert [item["case_id"] for item in result["case_results"]] == ["visible-1"]


def test_failed_hidden_case_hides_actual_expected_and_input():
    result = run("def square(x):\n    return 4")
    assert result["status"] == "Wrong Answer"
    failed = result["failed_case"]
    assert failed["is_hidden"] is True
    assert "actual" not in failed and "expected" not in failed
    assert "49" not in json.dumps(result) and "(7,)" not in json.dumps(result)


@pytest.mark.xfail(strict=True, reason="BUG-10: the exception message of a hidden case is returned, so learner code can leak hidden inputs via raise")
def test_exception_message_does_not_leak_hidden_input():
    result = run("def square(x):\n    if x != 2:\n        raise ValueError('input was %r' % x)\n    return 4")
    assert result["status"] == "Runtime Error"
    assert "7" not in json.dumps(result)


@pytest.mark.xfail(strict=True, reason="BUG-09: learner code can read the harness global `test_cases`, including hidden expected outputs")
def test_learner_code_cannot_read_hidden_expected_outputs():
    code = (
        "def square(x):\n"
        "    cases = globals()['test_cases']\n"
        "    return int(next(c['expectedOutput'] for c in cases if c['argsExpression'] == repr((x,))))\n"
    )
    # This "solution" never computes anything; it only copies the answers.
    result = run(code, [case("(2,)", "5"), case("(3,)", "11", hidden=True)])
    assert result["status"] != "Accepted"


# ---------------------------------------------------------------------------
# Result integrity
# ---------------------------------------------------------------------------

@pytest.mark.xfail(strict=True, reason="BUG-08: learner code can print the result marker with fake JSON and exit, and the runner reports Accepted")
def test_learner_code_cannot_forge_accepted_result():
    code = (
        "import sys, json\n"
        "def square(x):\n"
        "    print('---CODORA_RESULT_START---')\n"
        "    print(json.dumps([{'passed': True}] * len(globals()['test_cases'])))\n"
        "    sys.exit(0)\n"
    )
    assert run(code)["status"] != "Accepted"


def test_sys_exit_without_forged_output_is_runtime_error():
    result = run("import sys\ndef square(x):\n    sys.exit(0)")
    assert result["status"] == "Runtime Error"
    assert result["error"] == "No output produced from runner harness."


# ---------------------------------------------------------------------------
# Isolation from the server
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("danger", ["os.system", "shutil.rmtree", "subprocess", "pty.spawn"])
def test_blocklisted_calls_are_rejected_before_running(danger):
    result = run(f"# {danger}\ndef square(x):\n    return x * x")
    assert result["status"] == "Runtime Error"
    assert result["error"] == f"Security violation: call to '{danger}' is not permitted."
    assert result["runtime_ms"] == 0


@pytest.mark.xfail(strict=True, reason="BUG-07: learner code inherits the server's environment variables (DATABASE_URL, JWT_SECRET, OPENAI_API_KEY...)")
def test_learner_code_cannot_read_server_environment(monkeypatch):
    monkeypatch.setenv("CODORA_TEST_SENTINEL_SECRET", "sentinel-value-123")
    result = run("import os\ndef square(x):\n    return os.environ.get('CODORA_TEST_SENTINEL_SECRET')")
    assert "sentinel-value-123" not in json.dumps(result)


@pytest.mark.xfail(strict=True, reason="BUG-06: the substring blocklist is bypassed; learner code can run shell commands on the backend host")
@pytest.mark.parametrize("code", [
    "import os\ndef square(x):\n    return int(os.popen('echo %d' % (x * x)).read())",
    "def square(x):\n    sp = __import__('subpro' + 'cess')\n    return int(sp.check_output(['echo', str(x * x)]))",
])
def test_learner_code_cannot_run_shell_commands(code):
    assert run(code)["status"] != "Accepted"


@pytest.mark.xfail(strict=True, reason="BUG-06: learner code can read files on the backend host")
def test_learner_code_cannot_read_server_files(tmp_path):
    secret_file = tmp_path / "server-secret.txt"
    secret_file.write_text("file-secret-456")
    result = run(f"def square(x):\n    return open({str(secret_file)!r}).read()")
    assert "file-secret-456" not in json.dumps(result)
