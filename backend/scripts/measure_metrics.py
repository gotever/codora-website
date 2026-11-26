"""Measure Codora's evaluation metrics (docs/testing/test-plan.md, section 7).

Usage (from backend/, with the test containers from docker-compose.test.yml running):

    TEST_DATABASE_URL=postgresql://codora:codora-test-only@127.0.0.1:5433/codora_test \
    JWT_SECRET=test-only-jwt-secret-with-32-characters \
    python scripts/measure_metrics.py --out ../docs/testing/metrics-results.json

Optional: --openai-samples N also sends N real questions to /api/tutor/chat (needs OPENAI_API_KEY,
costs money). Without it the AI part of "task success rate" is reported as not measured.

Only the isolated test database is touched (name must end in _test). Users created by the script
use the e-mail prefix "metrics-" and are deleted at the end.
"""
import argparse
import json
import os
import statistics
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

BACKEND = Path(__file__).resolve().parents[1]
DATA = BACKEND / "data"
EMAIL_PREFIX = "metrics-"
PASSWORD = "test-only-password-123"

# --------------------------------------------------------------------------------------------
# Labelled data
# --------------------------------------------------------------------------------------------

# Learner messages labelled with the preference updates a human reader expects (field -> value).
PREFERENCE_DATASET = [
    ("Giải thích từng bước giúp mình nhé", {"explanation_style": "step_by_step"}),
    ("Can you explain step by step?", {"explanation_style": "step_by_step"}),
    ("Mình muốn hiểu theo khái niệm trước", {"explanation_style": "conceptual"}),
    ("Explain it conceptually please", {"explanation_style": "conceptual"}),
    ("Đi thẳng vào cách làm đi", {"explanation_style": "direct"}),
    ("Hướng dẫn trực tiếp thôi", {"explanation_style": "direct"}),
    ("Trả lời ngắn gọn thôi", {"detail_level": "concise"}),
    ("Keep it brief please", {"detail_level": "concise"}),
    ("Giải thích vừa đủ thôi", {"detail_level": "balanced"}),
    ("Mình thích giải thích chi tiết", {"detail_level": "detailed"}),
    ("Please explain in detail", {"detail_level": "detailed"}),
    ("Cho mình gợi ý tăng dần", {"hint_preference": "progressive"}),
    ("Chỉ cần một gợi ý ngắn", {"hint_preference": "minimal"}),
    ("Gợi ý tối thiểu thôi", {"hint_preference": "minimal"}),
    ("Nêu thẳng bước cần làm", {"hint_preference": "direct"}),
    ("Give me minimal hints", {"hint_preference": "minimal"}),
    ("Từng bước, chi tiết và gợi ý tăng dần", {"explanation_style": "step_by_step", "detail_level": "detailed", "hint_preference": "progressive"}),
    ("Ngắn gọn và đi thẳng vào cách làm", {"detail_level": "concise", "explanation_style": "direct"}),
    ("I want a detailed, step-by-step walkthrough", {"detail_level": "detailed", "explanation_style": "step_by_step"}),
    ("Không cần chi tiết đâu", {"detail_level": "concise"}),
    # Ordinary questions: no preference should be stored.
    ("Tại sao code của mình bị lỗi?", {}),
    ("Hàm này trả về gì?", {}),
    ("What is a list comprehension?", {}),
    ("Code chạy chậm quá", {}),
    ("Bài này có chi tiết gì cần chú ý không?", {}),
    ("Đừng giải thích từng bước nữa", {}),
    ("Bước tiếp theo là gì?", {}),
    ("How do I return directly from a loop?", {}),
    ("Lỗi IndentationError là gì?", {}),
    ("Can you explain the concept of recursion?", {}),
    ("My turtle moves in the wrong direction", {}),
    ("Giải thích giúp mình vòng lặp for", {}),
    ("Xin chào", {}),
    ("Bài tập tiếp theo có khó không?", {}),
    ("Mình chưa hiểu biến là gì", {}),
]

REFERENCE_SOLUTIONS = {
    "sum-of-even-numbers": "def sum_even(numbers):\n    return sum(n for n in numbers if n % 2 == 0)",
    "reverse-a-string": "def reverse_string(s):\n    return s[::-1]",
    "count-vowels": "def count_vowels(s):\n    return sum(ch in 'aeiouAEIOU' for ch in s)",
    "find-maximum": "def find_maximum(numbers):\n    return max(numbers)",
    "is-palindrome": "def is_palindrome(s):\n    return s == s[::-1]",
    "is-even-number": "def is_even(n):\n    return n % 2 == 0",
    "rectangle-area": "def rectangle_area(width, height):\n    return width * height",
    "count-words": "def count_words(text):\n    return len(text.split())",
    "find-second-largest": "def find_second_largest(numbers):\n    unique = sorted(set(numbers))\n    return unique[-2] if len(unique) >= 2 else None",
    "sum-digits-recursively": "def sum_digits(n):\n    return n if n < 10 else n % 10 + sum_digits(n // 10)",
}

# (slug, code, is_correct). Correct = right values *and* right return type for every input.
RUNNER_DATASET = [(slug, code, True) for slug, code in REFERENCE_SOLUTIONS.items()] + [
    # Alternative correct solutions
    ("sum-of-even-numbers", "def sum_even(numbers):\n    total = 0\n    for n in numbers:\n        if n % 2 == 0:\n            total += n\n    return total", True),
    ("reverse-a-string", "def reverse_string(s):\n    return ''.join(reversed(s))", True),
    ("count-vowels", "def count_vowels(s):\n    count = 0\n    for ch in s.lower():\n        if ch in 'aeiou':\n            count += 1\n    return count", True),
    ("find-maximum", "def find_maximum(numbers):\n    best = numbers[0]\n    for n in numbers[1:]:\n        if n > best:\n            best = n\n    return best", True),
    ("is-palindrome", "def is_palindrome(s):\n    i, j = 0, len(s) - 1\n    while i < j:\n        if s[i] != s[j]:\n            return False\n        i += 1\n        j -= 1\n    return True", True),
    ("is-even-number", "def is_even(n):\n    return not n & 1", True),
    ("rectangle-area", "def rectangle_area(width, height):\n    area = width\n    area *= height\n    return area", True),
    ("count-words", "import re\ndef count_words(text):\n    return len(re.findall(r'\\S+', text))", True),
    ("find-second-largest", "def find_second_largest(numbers):\n    first = second = None\n    for n in numbers:\n        if first is None or n > first:\n            first, second = n, first\n        elif n != first and (second is None or n > second):\n            second = n\n    return second", True),
    ("sum-digits-recursively", "def sum_digits(n):\n    return sum(int(d) for d in str(n))", True),
    # Typical learner mistakes
    ("sum-of-even-numbers", "def sum_even(numbers):\n    return sum(n for n in numbers if n % 2 == 1)", False),
    ("sum-of-even-numbers", "def sum_even(numbers):\n    return sum(numbers) // 2", False),
    ("reverse-a-string", "def reverse_string(s):\n    return s", False),
    ("reverse-a-string", "def reverse_string(s):\n    return s[::-1].strip()", False),
    ("count-vowels", "def count_vowels(s):\n    return sum(ch in 'aeiou' for ch in s)", False),
    ("count-vowels", "def count_vowels(s):\n    return sum(ch in 'aeiouyAEIOUY' for ch in s)", False),
    ("find-maximum", "def find_maximum(numbers):\n    return sorted(numbers)[0]", False),
    ("find-maximum", "def find_maximum(numbers):\n    best = 0\n    for n in numbers:\n        best = max(best, n)\n    return best", False),
    ("is-palindrome", "def is_palindrome(s):\n    return s[0] == s[-1] if s else True", False),
    ("is-even-number", "def is_even(n):\n    return n % 2 == 1", False),
    ("is-even-number", "def is_even(n):\n    return 1 if n % 2 == 0 else 0", False),
    ("rectangle-area", "def rectangle_area(width, height):\n    return width + height", False),
    ("count-words", "def count_words(text):\n    return text.count(' ') + 1", False),
    ("count-words", "def count_words(text):\n    return len(text.split(' '))", False),
    ("find-second-largest", "def find_second_largest(numbers):\n    return sorted(numbers)[-2]", False),
    ("sum-digits-recursively", "def sum_digits(n):\n    return n % 9", False),
    # Right digits, wrong return type (string instead of int/bool)
    ("is-palindrome", "def is_palindrome(s):\n    return str(s == s[::-1])", False),
    ("rectangle-area", "def rectangle_area(width, height):\n    return str(width * height)", False),
    ("sum-digits-recursively", "def sum_digits(n):\n    return str(sum(int(d) for d in str(n)))", False),
]

# Submissions that do not solve the task but try to game the grader (BUG-08, BUG-09).
ADVERSARIAL_DATASET = [
    ("rectangle-area", "import sys, json\ndef rectangle_area(width, height):\n    print('---CODORA_RESULT_START---')\n    print(json.dumps([{'passed': True}] * len(globals()['test_cases'])))\n    sys.exit(0)", False),
    ("rectangle-area", "def rectangle_area(width, height):\n    import ast\n    for case in globals()['test_cases']:\n        if ast.literal_eval(case['argsExpression']) == (width, height):\n            return int(case['expectedOutput'])", False),
]


# --------------------------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------------------------

def ratio(numerator, denominator):
    return round(numerator / denominator, 4) if denominator else None


def precision_recall(tp, fp, fn):
    return {"tp": tp, "fp": fp, "fn": fn, "precision": ratio(tp, tp + fp), "recall": ratio(tp, tp + fn)}


def load_source():
    curriculum = json.loads((DATA / "curriculum.json").read_text(encoding="utf-8"))
    hidden = json.loads((DATA / "hidden_test_cases.json").read_text(encoding="utf-8"))
    return curriculum, hidden


def exercise_cases(curriculum, hidden, slug):
    return [*({**case, "is_hidden": False} for case in curriculum["testCases"][slug]),
            *({**case, "is_hidden": True} for case in hidden.get(slug, []))]


def summarize_latency(samples_ms):
    ordered = sorted(samples_ms)
    return {
        "n": len(ordered),
        "median_ms": round(statistics.median(ordered), 2),
        "p90_ms": round(ordered[max(0, int(len(ordered) * 0.9) - 1)], 2),
        "min_ms": round(ordered[0], 2),
        "max_ms": round(ordered[-1], 2),
    }


def timed(call):
    start = time.perf_counter()
    response = call()
    return response, (time.perf_counter() - start) * 1000


def register(client_factory):
    client = client_factory()
    suffix = uuid4().hex[:12]
    body = {"email": f"{EMAIL_PREFIX}{suffix}@example.com", "username": f"metrics_{suffix}",
            "password": PASSWORD, "full_name": "Metrics"}
    response = client.post("/api/auth/register", json=body)
    response.raise_for_status()
    return client, response.json()["user"], body


# --------------------------------------------------------------------------------------------
# Metrics
# --------------------------------------------------------------------------------------------

def measure_preference_detector():
    from app.tutor import _explicit_learning_preference_updates as detect

    tp = fp = fn = exact = 0
    misses = []
    for message, gold in PREFERENCE_DATASET:
        predicted = detect(message)
        gold_pairs, predicted_pairs = set(gold.items()), set(predicted.items())
        tp += len(gold_pairs & predicted_pairs)
        fp += len(predicted_pairs - gold_pairs)
        fn += len(gold_pairs - predicted_pairs)
        if predicted == gold:
            exact += 1
        else:
            misses.append({"message": message, "expected": gold, "predicted": predicted})
    return {**precision_recall(tp, fp, fn), "messages": len(PREFERENCE_DATASET),
            "exact_match_rate": ratio(exact, len(PREFERENCE_DATASET)), "errors": misses}


def measure_runner(curriculum, hidden):
    from app.runner import run_code_sandbox

    functions = {exercise["id"]: exercise["functionName"] for exercise in curriculum["exercises"]}

    def evaluate(dataset):
        tp = fp = fn = tn = 0
        errors = []
        for slug, code, correct in dataset:
            result = run_code_sandbox(code, functions[slug], exercise_cases(curriculum, hidden, slug), timeout_seconds=3.0)
            accepted = result["status"] == "Accepted"
            tp += accepted and correct
            fp += accepted and not correct
            fn += (not accepted) and correct
            tn += (not accepted) and not correct
            if accepted != correct:
                errors.append({"exercise": slug, "expected_correct": correct, "status": result["status"],
                               "passed": f"{result['passed_count']}/{result['total_count']}", "code": code})
        return {**precision_recall(tp, fp, fn), "tn": tn, "submissions": len(dataset),
                "accuracy": ratio(tp + tn, len(dataset)), "errors": errors}

    return {"learner_submissions": evaluate(RUNNER_DATASET),
            "including_adversarial": evaluate(RUNNER_DATASET + ADVERSARIAL_DATASET)}


def measure_data_accuracy(client, db, curriculum, hidden):
    """Compare what the API / DB return with the curriculum source files, field by field."""
    checks, errors = 0, []

    def check(record, field, actual, expected):
        nonlocal checks
        checks += 1
        if actual != expected:
            errors.append({"record": record, "field": field, "actual": str(actual)[:120], "expected": str(expected)[:120]})

    source_fields = {
        "title": "title", "difficulty": "difficulty", "description": "description",
        "function_name": "functionName", "starter_code": "initialCode", "hints": "hints", "tags": "tags",
    }
    test_case_fields = ["examples", "constraints", "functionSignature", "number", "total", "filename"]
    for exercise in curriculum["exercises"]:
        slug = exercise["id"]
        response = client.get(f"/api/exercises/{slug}")
        check(slug, "http_status", response.status_code, 200)
        if response.status_code != 200:
            continue
        api = response.json()["exercise"]
        for api_field, source_field in source_fields.items():
            check(slug, api_field, api[api_field], exercise[source_field])
        check(slug, "test_cases.slug", api["test_cases"].get("slug"), slug)
        check(slug, "test_cases.runner", api["test_cases"].get("runner"), curriculum["testCases"][slug])
        for field in test_case_fields:
            check(slug, f"test_cases.{field}", api["test_cases"].get(field), exercise[field])
        check(slug, "hidden not exposed by API", "hidden" in api["test_cases"], False)
        stored = db.execute("SELECT test_cases->'hidden' AS hidden FROM exercises WHERE id=%s", (api["id"],)).fetchone()
        check(slug, "hidden stored in DB", stored["hidden"], hidden.get(slug, []))

    course = client.get("/api/courses").json()["courses"][0]
    check("course", "title", course["title"], curriculum["courses"][0]["title"])
    lessons = client.get(f"/api/courses/{course['id']}/lessons").json()["lessons"]
    check("course", "lesson count", len(lessons), len(curriculum["lessons"]))
    for lesson in lessons:
        check(f"lesson {lesson['order_index']}", "has versioned metadata",
              lesson["content_markdown"].startswith("<!-- codora-lesson:v1"), True)

    # Stored score after a graded submit must equal passed/total x 10.
    learner, user, _ = register(_new_client)
    partial = {"reverse-a-string": "def reverse_string(s):\n    return s[::-1] if s else 'x'",
               "sum-of-even-numbers": "def sum_even(numbers):\n    return sum(n for n in numbers if n % 2 == 0) if numbers else 1"}
    for slug, code in {**REFERENCE_SOLUTIONS, **partial}.items():
        exercise_id = client.get(f"/api/exercises/{slug}").json()["exercise"]["id"]
        result = learner.post(f"/api/exercises/{exercise_id}/submit", json={"code": code}).json()
        row = db.execute("SELECT score,status FROM user_progress WHERE user_id=%s AND item_type='exercise' AND item_id=%s",
                         (user["id"], str(exercise_id))).fetchone()
        expected_score = round(result["passed_count"] / result["total_count"] * 10, 4)
        check(f"score {slug}", "score", round(float(row["score"]), 4) if row else None, expected_score)

    return {"checks": checks, "errors": len(errors), "error_rate": ratio(len(errors), checks), "details": errors}


def measure_task_success(client, db, curriculum):
    """End-to-end learner task per exercise: open exercise, save draft, submit a correct solution,
    then find it completed in progress and in the submission history. Done once by id, once by slug."""
    outcomes = []
    for lookup in ("id", "slug"):
        learner, user, _ = register(lambda: _new_client(raise_server_exceptions=False))
        for exercise in curriculum["exercises"]:
            slug = exercise["id"]
            steps = {}
            detail = learner.get(f"/api/exercises/{slug}")
            steps["open"] = detail.status_code == 200
            exercise_id = detail.json()["exercise"]["id"] if steps["open"] else None
            key = exercise_id if lookup == "id" else slug
            steps["save_draft"] = learner.put(f"/api/exercises/{exercise_id}/workspace",
                                              json={"draft_code": REFERENCE_SOLUTIONS[slug]}).status_code == 200
            submit = learner.post(f"/api/exercises/{key}/submit", json={"code": REFERENCE_SOLUTIONS[slug]})
            steps["submit_accepted"] = submit.status_code == 200 and submit.json().get("status") == "Accepted"
            progress = {str(row["item_id"]): row["status"] for row in learner.get("/api/progress").json()["progress"]
                        if row["item_type"] == "exercise"}
            steps["progress_completed"] = progress.get(str(exercise_id)) == "completed"
            history = learner.get(f"/api/exercises/{exercise_id}/submissions").json().get("submissions", [])
            steps["in_history"] = any(item["status"] == "Accepted" for item in history)
            outcomes.append({"exercise": slug, "lookup": lookup, "success": all(steps.values()),
                             "failed_steps": [name for name, ok in steps.items() if not ok],
                             "submit_http_status": submit.status_code})
    by_lookup = {
        lookup: ratio(sum(o["success"] for o in outcomes if o["lookup"] == lookup),
                      sum(o["lookup"] == lookup for o in outcomes))
        for lookup in ("id", "slug")
    }
    return {"tasks": len(outcomes), "succeeded": sum(o["success"] for o in outcomes),
            "success_rate": ratio(sum(o["success"] for o in outcomes), len(outcomes)),
            "success_rate_by_lookup": by_lookup,
            "failures": [o for o in outcomes if not o["success"]]}


def measure_latency(client, samples):
    from app import tutor

    learner, user, body = register(_new_client)
    exercise_id = client.get("/api/exercises/reverse-a-string").json()["exercise"]["id"]
    lesson_id = client.get("/api/courses").json()["courses"][0]["id"]
    endpoints = {
        "GET /api/exercises": lambda: client.get("/api/exercises"),
        "GET /api/exercises/{id}": lambda: client.get(f"/api/exercises/{exercise_id}"),
        "GET /api/courses/{id}/lessons": lambda: client.get(f"/api/courses/{lesson_id}/lessons"),
        "GET /api/progress": lambda: learner.get("/api/progress"),
        "PUT /api/exercises/{id}/workspace": lambda: learner.put(f"/api/exercises/{exercise_id}/workspace", json={"draft_code": "x"}),
        "POST /api/auth/login": lambda: _new_client().post("/api/auth/login", json={"email": body["email"], "password": PASSWORD}),
        "POST /api/exercises/{id}/submit (Accepted, 20 test)": lambda: learner.post(
            f"/api/exercises/{exercise_id}/submit", json={"code": REFERENCE_SOLUTIONS["reverse-a-string"]}),
    }
    results = {}
    for name, call in endpoints.items():
        call()  # warm-up
        durations = []
        for _ in range(samples):
            response, elapsed = timed(call)
            assert response.status_code < 400, (name, response.status_code, response.text[:200])
            durations.append(elapsed)
        results[name] = summarize_latency(durations)

    # Tutor: backend time only, the OpenAI call is replaced by an instant fake reply.
    fake_reply = json.dumps({"answer": "Hint", "summary": "s", "structured_memory": {}})
    fake_api = SimpleNamespace(responses=SimpleNamespace(create=lambda **_: SimpleNamespace(output_text=fake_reply, usage=None)))
    original_openai, original_key = tutor.OpenAI, tutor.settings.openai_api_key
    tutor.OpenAI, tutor.settings.openai_api_key = (lambda **_: fake_api), "fake-key-for-latency"
    try:
        durations = []
        for _ in range(samples):
            response, elapsed = timed(lambda: learner.post("/api/tutor/chat", json={
                "context_type": "exercise", "context_id": exercise_id, "message": "Why does my code fail?"}))
            assert response.status_code == 200, response.text[:200]
            durations.append(elapsed)
        results["POST /api/tutor/chat (OpenAI giả lập, chỉ phần backend)"] = summarize_latency(durations)
    finally:
        tutor.OpenAI, tutor.settings.openai_api_key = original_openai, original_key
    return results


def measure_tutor_with_openai(samples):
    if samples <= 0:
        return {"status": "not_measured", "reason": "run with --openai-samples N and a real OPENAI_API_KEY"}
    from app.settings import settings
    if not settings.openai_api_key or settings.openai_api_key.lower().startswith("replace-"):
        return {"status": "not_measured", "reason": "OPENAI_API_KEY is not set"}
    learner, _, _ = register(_new_client)
    exercise_id = _new_client().get("/api/exercises/count-vowels").json()["exercise"]["id"]
    questions = ["Why does my loop miss uppercase vowels?", "Gợi ý cho mình bước đầu tiên", "What does `in` do here?",
                 "Code của mình bị lỗi TypeError", "Explain the expected output"]
    succeeded, durations, failures = 0, [], []
    for index in range(samples):
        response, elapsed = timed(lambda: learner.post("/api/tutor/chat", json={
            "context_type": "exercise", "context_id": exercise_id, "message": questions[index % len(questions)]}))
        durations.append(elapsed)
        ok = response.status_code == 200 and bool(str(response.json().get("answer", "")).strip())
        succeeded += ok
        if not ok:
            failures.append({"status": response.status_code, "body": response.text[:200]})
    return {"status": "measured", "samples": samples, "succeeded": succeeded,
            "success_rate": ratio(succeeded, samples), "latency": summarize_latency(durations), "failures": failures}


# --------------------------------------------------------------------------------------------

def _new_client(raise_server_exceptions=True):
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app, raise_server_exceptions=raise_server_exceptions)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--samples", type=int, default=30, help="requests per endpoint for latency")
    parser.add_argument("--openai-samples", type=int, default=0, help="real tutor calls (costs money)")
    parser.add_argument("--out", type=Path, help="write results as JSON to this file")
    args = parser.parse_args()

    test_url = os.getenv("TEST_DATABASE_URL", "")
    if not test_url.rsplit("/", 1)[-1].split("?", 1)[0].endswith("_test"):
        sys.exit("TEST_DATABASE_URL must point to a database whose name ends in _test")
    os.environ["DATABASE_URL"] = test_url
    os.environ.setdefault("JWT_SECRET", "test-only-jwt-secret-with-32-characters")
    sys.path.insert(0, str(BACKEND))
    for module in ("app.migrate", "app.seed"):
        subprocess.run([sys.executable, "-m", module], cwd=BACKEND, check=True, capture_output=True, text=True)

    import psycopg
    from psycopg.rows import dict_row
    from app import db as app_db

    app_db.pool.open()
    curriculum, hidden = load_source()
    client = _new_client()
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=BACKEND, capture_output=True, text=True).stdout.strip()
    with psycopg.connect(test_url, row_factory=dict_row, autocommit=True) as db:
        try:
            results = {
                "measured_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "commit": commit,
                "python": sys.version.split()[0],
                "task_success": {
                    "learner_flows": measure_task_success(client, db, curriculum),
                    "ai_tutor_real_openai": measure_tutor_with_openai(args.openai_samples),
                },
                "precision_recall": {
                    "preference_detector": measure_preference_detector(),
                    "runner": measure_runner(curriculum, hidden),
                },
                "data_accuracy": measure_data_accuracy(client, db, curriculum, hidden),
                "latency": measure_latency(client, args.samples),
            }
        finally:
            db.execute("DELETE FROM users WHERE email LIKE %s", (EMAIL_PREFIX + "%",))
            app_db.pool.close()

    text = json.dumps(results, ensure_ascii=False, indent=2)
    if args.out:
        args.out.write_text(text + "\n", encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
