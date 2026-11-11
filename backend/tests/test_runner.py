from app.runner import run_code_sandbox


def test_sandbox_accepted():
    code = "def is_palindrome(s): return s == s[::-1]"
    cases = [
        {"id": "tc-1", "label": "Case 1", "argsExpression": "('radar',)", "expectedOutput": "True", "is_hidden": False},
        {"id": "tc-2", "label": "Case 2", "argsExpression": "('hello',)", "expectedOutput": "False", "is_hidden": True},
    ]
    res = run_code_sandbox(code, "is_palindrome", cases)
    assert res["status"] == "Accepted"
    assert res["passed_count"] == 2
    assert res["total_count"] == 2
    assert res["error"] is None


def test_sandbox_wrong_answer():
    code = "def is_palindrome(s): return True"
    cases = [
        {"id": "tc-1", "label": "Case 1", "argsExpression": "('radar',)", "expectedOutput": "True", "is_hidden": False},
        {"id": "tc-2", "label": "Case 2", "argsExpression": "('hello',)", "expectedOutput": "False", "is_hidden": True},
    ]
    res = run_code_sandbox(code, "is_palindrome", cases)
    assert res["status"] == "Wrong Answer"
    assert res["passed_count"] == 1
    assert res["total_count"] == 2
    assert res["failed_case"] is not None
    assert res["failed_case"]["is_hidden"] is True
    # Verify hidden test case output is NOT leaked
    assert "actual" not in res["failed_case"]
    assert "expected" not in res["failed_case"]


def test_sandbox_time_limit_exceeded():
    code = "def is_palindrome(s):\n    while True:\n        pass"
    cases = [
        {"id": "tc-1", "label": "Case 1", "argsExpression": "('radar',)", "expectedOutput": "True", "is_hidden": False},
    ]
    res = run_code_sandbox(code, "is_palindrome", cases, timeout_seconds=1.0)
    assert res["status"] == "Time Limit Exceeded"
    assert res["passed_count"] == 0
    assert "Time Limit Exceeded" in res["error"]


def test_sandbox_syntax_error():
    code = "def is_palindrome(s) return True"
    cases = [
        {"id": "tc-1", "label": "Case 1", "argsExpression": "('radar',)", "expectedOutput": "True", "is_hidden": False},
    ]
    res = run_code_sandbox(code, "is_palindrome", cases)
    assert res["status"] == "Syntax Error"
    assert res["passed_count"] == 0
    assert "SyntaxError" in res["error"]


def test_sandbox_runtime_error():
    code = "def is_palindrome(s): return 1 / 0"
    cases = [
        {"id": "tc-1", "label": "Case 1", "argsExpression": "('radar',)", "expectedOutput": "True", "is_hidden": False},
    ]
    res = run_code_sandbox(code, "is_palindrome", cases)
    assert res["status"] == "Runtime Error"
    assert res["passed_count"] == 0
    assert "ZeroDivisionError" in res["error"]


def test_sandbox_disallows_security_violation():
    code = "import os\ndef is_palindrome(s):\n    os.system('ls')\n    return True"
    cases = [
        {"id": "tc-1", "label": "Case 1", "argsExpression": "('radar',)", "expectedOutput": "True", "is_hidden": False},
    ]
    res = run_code_sandbox(code, "is_palindrome", cases)
    assert res["status"] == "Runtime Error"
    assert "Security violation" in res["error"]

\n