"""API tests for exercises, submit and submission history, against the isolated test database.

Needs TEST_DATABASE_URL (database name ending in _test, see docs/testing/test-environment.md).
The module migrates and seeds that database itself, so it does not depend on other test files.
Known defects are xfail(strict=True) with their bug ID from docs/testing/.
"""
import os
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="Set TEST_DATABASE_URL to an isolated local database ending in _test")

BACKEND = Path(__file__).resolve().parents[1]
EMAIL_PREFIX = "api-exercises-"

# Reference solutions for the 10 seeded exercises (keyed by slug).
SOLUTIONS = {
    "sum-of-even-numbers": "def sum_even(numbers):\n    return sum(n for n in numbers if n % 2 == 0)",
    "reverse-a-string": "def reverse_string(s):\n    return s[::-1]",
    "count-vowels": "def count_vowels(s):\n    return sum(ch in 'aeiouAEIOU' for ch in s)",
    "find-maximum": "def find_maximum(numbers):\n    return max(numbers)",
    "is-palindrome": "def is_palindrome(s):\n    return s == s[::-1]",
    "is-even-number": "def is_even(n):\n    return n % 2 == 0",
    "rectangle-area": "def rectangle_area(width, height):\n    return width * height",
    "count-words": "def count_words(text):\n    return len(text.split())",
    "find-second-largest": (
        "def find_second_largest(numbers):\n"
        "    unique = sorted(set(numbers))\n"
        "    return unique[-2] if len(unique) >= 2 else None"
    ),
    "sum-digits-recursively": "def sum_digits(n):\n    return n if n < 10 else n % 10 + sum_digits(n // 10)",
}
# Passes the 3 visible cases and the first 12 hidden cases, then fails hidden case 13 (empty string).
REVERSE_PARTIAL = "def reverse_string(s):\n    return s[::-1] if s else 'x'"


@pytest.fixture(scope="module")
def db():
    db_name = TEST_DATABASE_URL.rsplit("/", 1)[-1].split("?", 1)[0]
    assert db_name.endswith("_test"), "refusing to run against a non-test database"
    env = {**os.environ, "DATABASE_URL": TEST_DATABASE_URL}
    for module in ("app.migrate", "app.seed"):
        subprocess.run([sys.executable, "-m", module], cwd=BACKEND, env=env, check=True, capture_output=True, text=True)

    from app import db as app_db

    previous_pool = app_db.pool
    test_pool = ConnectionPool(TEST_DATABASE_URL, min_size=1, max_size=5, kwargs={"row_factory": dict_row}, open=True)
    app_db.pool = test_pool
    with psycopg.connect(TEST_DATABASE_URL, row_factory=dict_row, autocommit=True) as conn:
        try:
            yield conn
        finally:
            conn.execute("DELETE FROM users WHERE email LIKE %s", (EMAIL_PREFIX + "%",))
            test_pool.close()
            app_db.pool = previous_pool


@pytest.fixture(scope="module")
def exercises(db):
    rows = db.execute("SELECT id,lesson_id,function_name,test_cases FROM exercises ORDER BY id").fetchall()
    return {row["test_cases"]["slug"]: row for row in rows}


@pytest.fixture
def anonymous(db):
    from app.main import app
    return TestClient(app)


def new_user_client():
    from app.main import app
    client = TestClient(app)
    suffix = uuid4().hex[:12]
    response = client.post("/api/auth/register", json={
        "email": f"{EMAIL_PREFIX}{suffix}@example.com",
        "username": f"apiex_{suffix}",
        "password": "test-only-password-123",
        "full_name": "API Exercises Test",
    })
    assert response.status_code in (200, 201), response.text
    user_id = client.get("/api/auth/me").json()["user"]["id"]
    return client, user_id


@pytest.fixture
def learner(db):
    return new_user_client()


def progress_row(db, user_id, exercise_id):
    return db.execute(
        "SELECT status,score,completed_at FROM user_progress WHERE user_id=%s AND item_type='exercise' AND item_id=%s",
        (user_id, str(exercise_id)),
    ).fetchone()


# ---------------------------------------------------------------------------
# Reading exercises
# ---------------------------------------------------------------------------

def test_list_returns_all_seeded_exercises_without_hidden_cases(anonymous, exercises):
    response = anonymous.get("/api/exercises")
    assert response.status_code == 200
    listed = response.json()["exercises"]
    assert {row["id"] for row in listed} >= {row["id"] for row in exercises.values()}
    for row in listed:
        assert "hidden" not in row["test_cases"]


def test_list_matches_database_except_hidden(anonymous, exercises):
    listed = {row["id"]: row for row in anonymous.get("/api/exercises").json()["exercises"]}
    for row in exercises.values():
        expected = {key: value for key, value in row["test_cases"].items() if key != "hidden"}
        assert listed[row["id"]]["test_cases"] == expected


def test_seeded_exercises_have_visible_and_hidden_cases(exercises):
    assert len(exercises) == 10
    for slug, row in exercises.items():
        assert len(row["test_cases"]["runner"]) >= 1, slug
        assert len(row["test_cases"]["hidden"]) >= 1, slug


@pytest.mark.parametrize("lookup", ["id", "slug", "function_name", "function-name"])
def test_get_exercise_by_id_slug_or_function_name(anonymous, exercises, lookup):
    row = exercises["sum-of-even-numbers"]
    key = {
        "id": str(row["id"]),
        "slug": "sum-of-even-numbers",
        "function_name": row["function_name"],
        "function-name": row["function_name"].replace("_", "-"),
    }[lookup]
    response = anonymous.get(f"/api/exercises/{key}")
    assert response.status_code == 200
    exercise = response.json()["exercise"]
    assert exercise["id"] == row["id"]
    assert "hidden" not in exercise["test_cases"]


def test_every_seeded_slug_resolves_to_its_own_exercise(anonymous, exercises):
    for slug, row in exercises.items():
        assert anonymous.get(f"/api/exercises/{slug}").json()["exercise"]["id"] == row["id"], slug


@pytest.mark.parametrize("key", ["999999", "no-such-exercise", "0"])
def test_get_unknown_exercise_returns_404(anonymous, key):
    response = anonymous.get(f"/api/exercises/{key}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Exercise not found"}


def test_get_exercise_response_never_contains_hidden_expected_outputs(anonymous, exercises):
    row = exercises["reverse-a-string"]
    body = anonymous.get(f"/api/exercises/{row['id']}").text
    visible_args = {case["argsExpression"] for case in row["test_cases"]["runner"]}
    hidden_only = [case for case in row["test_cases"]["hidden"] if case["argsExpression"] not in visible_args]
    assert hidden_only
    for case in hidden_only:
        assert case["label"] not in body


def test_lesson_exercises_only_returns_that_lesson(anonymous, exercises):
    lesson_id = exercises["sum-of-even-numbers"]["lesson_id"]
    rows = anonymous.get(f"/api/lessons/{lesson_id}/exercises").json()["exercises"]
    assert rows and all(row["lesson_id"] == lesson_id for row in rows)
    assert all("hidden" not in row["test_cases"] for row in rows)


def test_lesson_without_exercises_returns_empty_list(anonymous):
    response = anonymous.get("/api/lessons/999999/exercises")
    assert response.status_code == 200
    assert response.json() == {"exercises": []}


# ---------------------------------------------------------------------------
# Submit
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("slug", sorted(SOLUTIONS))
def test_reference_solution_is_accepted_on_all_cases(anonymous, exercises, slug):
    row = exercises[slug]
    result = anonymous.post(f"/api/exercises/{row['id']}/submit", json={"code": SOLUTIONS[slug]}).json()
    total = len(row["test_cases"]["runner"]) + len(row["test_cases"]["hidden"])
    assert result["status"] == "Accepted", result
    assert result["passed_count"] == result["total_count"] == total


def test_submit_by_slug_works_for_anonymous_user(anonymous):
    result = anonymous.post("/api/exercises/is-palindrome/submit", json={"code": SOLUTIONS["is-palindrome"]}).json()
    assert result["status"] == "Accepted"


def test_wrong_answer_on_hidden_case_does_not_leak_it(anonymous, exercises):
    row = exercises["reverse-a-string"]
    result = anonymous.post(f"/api/exercises/{row['id']}/submit", json={"code": REVERSE_PARTIAL}).json()
    assert result["status"] == "Wrong Answer"
    assert (result["passed_count"], result["total_count"]) == (15, 20)
    assert result["failed_case"]["is_hidden"] is True
    assert "actual" not in result["failed_case"] and "expected" not in result["failed_case"]
    assert all(not case["case_id"].startswith("hidden") for case in result["case_results"])


def test_anonymous_submit_does_not_write_progress(anonymous, db, exercises):
    before = db.execute("SELECT count(*) AS n FROM user_progress").fetchone()["n"]
    anonymous.post(f"/api/exercises/{exercises['is-even-number']['id']}/submit", json={"code": SOLUTIONS["is-even-number"]})
    assert db.execute("SELECT count(*) AS n FROM user_progress").fetchone()["n"] == before


@pytest.mark.parametrize("key", ["999999", "no-such-exercise"])
def test_submit_unknown_exercise_returns_404(anonymous, key):
    response = anonymous.post(f"/api/exercises/{key}/submit", json={"code": "def f(): pass"})
    assert response.status_code == 404


@pytest.mark.parametrize("body", [{}, {"code": ""}, {"code": "x" * 100_001}])
def test_submit_invalid_body_returns_422(anonymous, exercises, body):
    response = anonymous.post(f"/api/exercises/{exercises['is-palindrome']['id']}/submit", json=body)
    assert response.status_code == 422


def test_submit_exercise_without_test_cases_returns_400(anonymous, db, exercises):
    lesson_id = exercises["sum-of-even-numbers"]["lesson_id"]
    exercise_id = db.execute(
        """INSERT INTO exercises(lesson_id,title,difficulty,function_name,test_cases)
           VALUES(%s,'API test fixture without cases','Easy','api_fixture_no_cases','{}'::jsonb) RETURNING id""",
        (lesson_id,),
    ).fetchone()["id"]
    try:
        response = anonymous.post(f"/api/exercises/{exercise_id}/submit", json={"code": "def api_fixture_no_cases(): pass"})
        assert response.status_code == 400
        assert response.json() == {"detail": "No test cases configured for this exercise"}
    finally:
        db.execute("DELETE FROM exercises WHERE id=%s", (exercise_id,))


# ---------------------------------------------------------------------------
# Progress, score formula and submission history (signed in)
# ---------------------------------------------------------------------------

def test_accepted_submit_marks_exercise_completed_with_score_10(learner, db, exercises):
    client, user_id = learner
    row = exercises["rectangle-area"]
    assert client.post(f"/api/exercises/{row['id']}/submit", json={"code": SOLUTIONS["rectangle-area"]}).json()["status"] == "Accepted"
    progress = progress_row(db, user_id, row["id"])
    assert progress["status"] == "completed"
    assert float(progress["score"]) == 10.0
    assert progress["completed_at"] is not None


def test_partial_submit_score_is_passed_over_total_times_10(learner, db, exercises):
    client, user_id = learner
    row = exercises["reverse-a-string"]
    result = client.post(f"/api/exercises/{row['id']}/submit", json={"code": REVERSE_PARTIAL}).json()
    progress = progress_row(db, user_id, row["id"])
    assert progress["status"] == "in_progress"
    assert progress["completed_at"] is None
    assert float(progress["score"]) == pytest.approx(result["passed_count"] / result["total_count"] * 10) == 7.5


def test_completed_status_is_kept_after_a_later_wrong_submit(learner, db, exercises):
    client, user_id = learner
    row = exercises["reverse-a-string"]
    client.post(f"/api/exercises/{row['id']}/submit", json={"code": SOLUTIONS["reverse-a-string"]})
    first_completed_at = progress_row(db, user_id, row["id"])["completed_at"]
    client.post(f"/api/exercises/{row['id']}/submit", json={"code": REVERSE_PARTIAL})
    progress = progress_row(db, user_id, row["id"])
    assert progress["status"] == "completed"
    assert progress["completed_at"] == first_completed_at


def test_submission_history_lists_attempts_newest_first(learner, exercises):
    client, _ = learner
    row = exercises["count-words"]
    client.post(f"/api/exercises/{row['id']}/submit", json={"code": "def count_words(text):\n    return 0"})
    client.post(f"/api/exercises/{row['id']}/submit", json={"code": SOLUTIONS["count-words"]})
    response = client.get(f"/api/exercises/{row['id']}/submissions")
    assert response.status_code == 200
    submissions = response.json()["submissions"]
    assert [item["status"] for item in submissions] == ["Accepted", "Wrong Answer"]
    assert submissions[0]["code"] == SOLUTIONS["count-words"]
    assert submissions[0]["passed_count"] == submissions[0]["total_count"] == 20
    assert submissions[0]["created_at"] >= submissions[1]["created_at"]


def test_submission_is_stored_for_the_tutor_without_hidden_expected_values(learner, db, exercises):
    client, user_id = learner
    row = exercises["reverse-a-string"]
    client.post(f"/api/exercises/{row['id']}/submit", json={"code": REVERSE_PARTIAL})
    stored = db.execute(
        "SELECT message,context_key FROM ai_chats WHERE user_id=%s AND event_type='submission' ORDER BY created_at DESC LIMIT 1",
        (user_id,),
    ).fetchone()
    assert stored["context_key"] == f"exercise:{row['id']}"
    assert '"expected"' not in stored["message"] and '"actual"' not in stored["message"]


def test_submission_history_is_private_to_each_user(db, exercises):
    owner, _ = new_user_client()
    other, _ = new_user_client()
    row = exercises["find-maximum"]
    owner.post(f"/api/exercises/{row['id']}/submit", json={"code": SOLUTIONS["find-maximum"]})
    assert len(owner.get(f"/api/exercises/{row['id']}/submissions").json()["submissions"]) == 1
    assert other.get(f"/api/exercises/{row['id']}/submissions").json() == {"submissions": []}


def test_submission_history_for_unknown_exercise_returns_404(learner):
    client, _ = learner
    assert client.get("/api/exercises/999999/submissions").status_code == 404


@pytest.mark.xfail(strict=True, reason="BUG-12: signed-in submit by slug inserts the slug into the BIGINT ai_chats.exercise_id column and fails with 500")
def test_signed_in_submit_by_slug_is_recorded(db, exercises):
    from app.main import app
    client, user_id = new_user_client()
    client = TestClient(app, raise_server_exceptions=False, cookies=client.cookies)
    response = client.post("/api/exercises/is-palindrome/submit", json={"code": SOLUTIONS["is-palindrome"]})
    assert response.status_code == 200
    assert progress_row(db, user_id, exercises["is-palindrome"]["id"])["status"] == "completed"
