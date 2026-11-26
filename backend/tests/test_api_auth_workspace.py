"""API tests for auth, learner level/preferences, progress, workspace and lesson challenge progress,
against the isolated test database (owner isolation between users included).

Needs TEST_DATABASE_URL (database name ending in _test, see docs/testing/test-environment.md).
The module migrates and seeds that database itself. Known defects are xfail(strict=True) with
their bug ID from docs/testing/.
"""
import json
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
EMAIL_PREFIX = "api-auth-"
PASSWORD = "test-only-password-123"


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


def client():
    from app.main import app
    return TestClient(app)


def credentials(**changes):
    suffix = uuid4().hex[:12]
    return {
        "email": f"{EMAIL_PREFIX}{suffix}@example.com",
        "username": f"apiauth_{suffix}",
        "password": PASSWORD,
        "full_name": "API Auth Test",
        **changes,
    }


def signed_in(**changes):
    browser = client()
    body = credentials(**changes)
    response = browser.post("/api/auth/register", json=body)
    assert response.status_code == 201, response.text
    return browser, response.json()["user"], body


@pytest.fixture
def learner(db):
    return signed_in()


@pytest.fixture(scope="module")
def first_lessons(db):
    rows = db.execute("""SELECT l.id,l.content_markdown FROM lessons l JOIN courses c ON c.id=l.course_id
        WHERE c.title='Python fundamentals' ORDER BY l.order_index,l.id""").fetchall()
    assert len(rows) >= 6
    return rows


@pytest.fixture(scope="module")
def exercise_ids(db):
    return [row["id"] for row in db.execute("SELECT id FROM exercises ORDER BY id").fetchall()]


@pytest.fixture(scope="module")
def lesson_challenge(first_lessons):
    marker = "<!-- codora-lesson:v1\n"
    for lesson in first_lessons:
        metadata = json.loads(lesson["content_markdown"][len(marker):].split("\n-->\n", 1)[0])
        for section in metadata.get("sections", []):
            challenge = section.get("challenge") if isinstance(section, dict) else None
            if isinstance(challenge, dict) and challenge.get("id"):
                return lesson["id"], challenge["id"]
    pytest.fail("no seeded lesson has a code challenge")


# ---------------------------------------------------------------------------
# Register / login / logout / me
# ---------------------------------------------------------------------------

def test_register_creates_user_and_session_cookie(db):
    browser = client()
    body = credentials(email=f"{EMAIL_PREFIX}{uuid4().hex[:8]}@EXAMPLE.com")
    response = browser.post("/api/auth/register", json=body)
    assert response.status_code == 201
    user = response.json()["user"]
    assert user["email"] == body["email"].lower()
    assert user["level"] == "beginner"
    assert "password_hash" not in user and PASSWORD not in response.text
    cookie = response.headers["set-cookie"].lower()
    assert cookie.startswith("codora_session=") and "httponly" in cookie and "samesite=lax" in cookie
    assert browser.get("/api/auth/me").json()["user"]["id"] == user["id"]


def test_password_is_stored_as_argon2id_hash(db, learner):
    _, user, _ = learner
    stored = db.execute("SELECT password_hash FROM users WHERE id=%s", (user["id"],)).fetchone()["password_hash"]
    assert stored.startswith("$argon2id$") and PASSWORD not in stored


@pytest.mark.parametrize("field", ["email", "username"])
def test_register_duplicate_email_or_username_returns_409(learner, field):
    _, _, body = learner
    duplicate = credentials(**{field: body[field].upper() if field == "email" else body[field]})
    response = client().post("/api/auth/register", json=duplicate)
    assert response.status_code == 409
    assert response.json() == {"detail": "Email or username is already registered"}


def test_login_is_case_insensitive_on_email_and_sets_cookie(learner):
    _, user, body = learner
    browser = client()
    response = browser.post("/api/auth/login", json={"email": body["email"].upper(), "password": PASSWORD})
    assert response.status_code == 200
    assert response.json()["user"]["id"] == user["id"]
    assert "password_hash" not in response.json()["user"]
    assert browser.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize("case", ["wrong_password", "unknown_email"])
def test_login_failures_return_same_generic_401(learner, case):
    _, _, body = learner
    payload = {"email": body["email"], "password": "wrong-password-123"} if case == "wrong_password" \
        else {"email": f"nobody-{uuid4().hex[:8]}@example.com", "password": PASSWORD}
    response = client().post("/api/auth/login", json=payload)
    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}
    assert "set-cookie" not in response.headers


def test_logout_ends_browser_session(learner):
    browser, _, _ = learner
    assert browser.post("/api/auth/logout").status_code == 200
    assert browser.get("/api/auth/me").status_code == 401


def test_token_of_deleted_user_is_rejected(db):
    browser, user, _ = signed_in()
    db.execute("DELETE FROM users WHERE id=%s", (user["id"],))
    assert browser.get("/api/auth/me").status_code == 401


# ---------------------------------------------------------------------------
# Level and learning preferences
# ---------------------------------------------------------------------------

def test_beginner_can_keep_beginner_level(learner):
    browser, _, _ = learner
    response = browser.put("/api/auth/level", json={"level": "beginner"})
    assert response.status_code == 200 and response.json() == {"level": "beginner"}


@pytest.mark.parametrize("level", ["intermediate", "advanced"])
def test_beginner_cannot_raise_own_level_without_assessment(learner, level):
    browser, _, _ = learner
    response = browser.put("/api/auth/level", json={"level": level})
    assert response.status_code == 403
    assert browser.get("/api/auth/me").json()["user"]["level"] == "beginner"


@pytest.mark.xfail(strict=True, reason="BUG-13: POST /api/auth/register accepts a client-chosen level, so anyone can sign up as advanced without the assessment")
def test_register_cannot_choose_a_higher_level(db):
    response = client().post("/api/auth/register", json=credentials(level="advanced"))
    assert response.status_code == 422 or response.json()["user"]["level"] == "beginner"


@pytest.mark.xfail(strict=True, reason="BUG-13: a non-beginner can set any level (e.g. intermediate -> advanced) through PUT /api/auth/level")
def test_intermediate_cannot_jump_to_advanced_without_assessment(db):
    browser, user, _ = signed_in()
    db.execute("UPDATE users SET level='intermediate' WHERE id=%s", (user["id"],))
    response = browser.put("/api/auth/level", json={"level": "advanced"})
    assert response.status_code == 403


def test_learning_preferences_are_saved_and_returned_by_me(learner):
    browser, _, _ = learner
    preferences = {"explanation_style": "step_by_step", "detail_level": "concise", "hint_preference": "minimal"}
    response = browser.put("/api/auth/learning-preferences", json=preferences)
    assert response.status_code == 200 and response.json() == {"learning_preferences": preferences}
    assert browser.get("/api/auth/me").json()["user"]["learning_preferences"] == preferences


def test_learning_preferences_can_be_reset_to_null(learner):
    browser, _, _ = learner
    browser.put("/api/auth/learning-preferences", json={"explanation_style": "direct"})
    response = browser.put("/api/auth/learning-preferences", json={})
    assert response.json()["learning_preferences"] == {"explanation_style": None, "detail_level": None, "hint_preference": None}


def test_learning_preferences_reject_unknown_value(learner):
    browser, _, _ = learner
    assert browser.put("/api/auth/learning-preferences", json={"detail_level": "huge"}).status_code == 422


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------

def test_new_user_has_empty_progress(learner):
    browser, _, _ = learner
    body = browser.get("/api/progress").json()
    assert body["progress"] == [] and body["completed_lessons"] == []
    assert body["completed_lesson_challenges"] == 0


def test_completing_a_lesson_is_listed_in_progress(learner, first_lessons):
    browser, _, _ = learner
    lesson_id = first_lessons[0]["id"]
    response = browser.put("/api/progress", json={"item_type": "lesson", "item_id": lesson_id, "status": "completed"})
    assert response.status_code == 200
    saved = response.json()["progress"]
    assert saved["status"] == "completed" and saved["completed_at"] is not None
    body = browser.get("/api/progress").json()
    assert [(row["item_type"], str(row["item_id"])) for row in body["progress"]] == [("lesson", str(lesson_id))]
    assert [lesson["id"] for lesson in body["completed_lessons"]] == [lesson_id]


def test_reopening_a_lesson_clears_completed_at(learner, first_lessons):
    browser, _, _ = learner
    lesson_id = first_lessons[1]["id"]
    browser.put("/api/progress", json={"item_type": "lesson", "item_id": lesson_id, "status": "completed"})
    saved = browser.put("/api/progress", json={"item_type": "lesson", "item_id": lesson_id, "status": "in_progress"}).json()["progress"]
    assert saved["status"] == "in_progress" and saved["completed_at"] is None


def test_score_is_kept_when_later_update_has_no_score(learner, exercise_ids):
    browser, _, _ = learner
    browser.put("/api/progress", json={"item_type": "exercise", "item_id": exercise_ids[0], "status": "in_progress", "score": 4})
    saved = browser.put("/api/progress", json={"item_type": "exercise", "item_id": exercise_ids[0], "status": "in_progress"}).json()["progress"]
    assert float(saved["score"]) == 4.0


def test_score_on_lesson_is_rejected(learner, first_lessons):
    browser, _, _ = learner
    response = browser.put("/api/progress", json={"item_type": "lesson", "item_id": first_lessons[0]["id"], "status": "completed", "score": 10})
    assert response.status_code == 422


@pytest.mark.parametrize("item_type", ["lesson", "exercise"])
def test_progress_for_unknown_item_returns_404(learner, item_type):
    browser, _, _ = learner
    response = browser.put("/api/progress", json={"item_type": item_type, "item_id": 999999, "status": "completed"})
    assert response.status_code == 404


def test_progress_is_private_to_each_user(first_lessons):
    owner, _, _ = signed_in()
    other, _, _ = signed_in()
    owner.put("/api/progress", json={"item_type": "lesson", "item_id": first_lessons[0]["id"], "status": "completed"})
    assert len(owner.get("/api/progress").json()["progress"]) == 1
    assert other.get("/api/progress").json()["progress"] == []


def test_completing_six_lessons_and_top_scores_does_not_promote_without_assessment(learner, first_lessons, exercise_ids):
    browser, _, _ = learner
    for lesson in first_lessons[:6]:
        response = browser.put("/api/progress", json={"item_type": "lesson", "item_id": lesson["id"], "status": "completed"})
        assert "level" not in response.json()
    for exercise_id in exercise_ids:
        response = browser.put("/api/progress", json={"item_type": "exercise", "item_id": exercise_id, "status": "completed", "score": 10})
        assert "level" not in response.json()
    assert browser.get("/api/auth/me").json()["user"]["level"] == "beginner"
    assert browser.put("/api/auth/level", json={"level": "intermediate"}).status_code == 403


@pytest.mark.xfail(strict=True, reason="BUG-14: PUT /api/progress trusts a client-reported exercise status/score, so an exercise can be marked completed with 10/10 without any graded submission")
def test_exercise_cannot_be_completed_without_a_graded_submission(learner, exercise_ids):
    browser, _, _ = learner
    response = browser.put("/api/progress", json={"item_type": "exercise", "item_id": exercise_ids[1], "status": "completed", "score": 10})
    assert response.status_code in (400, 403, 422)


# ---------------------------------------------------------------------------
# Exercise workspace
# ---------------------------------------------------------------------------

EMPTY_WORKSPACE = {"draft_code": None, "latest_run_code": None, "latest_run_result": None, "updated_at": None}


def test_workspace_is_empty_before_first_save(learner, exercise_ids):
    browser, _, _ = learner
    assert browser.get(f"/api/exercises/{exercise_ids[0]}/workspace").json() == EMPTY_WORKSPACE


def test_workspace_round_trip_with_unicode(learner, exercise_ids):
    browser, _, _ = learner
    body = {"draft_code": "# Xin chào 👋\nprint('đ')", "latest_run_code": "print(1)", "latest_run_result": {"status": "ok", "passed": 3}}
    assert browser.put(f"/api/exercises/{exercise_ids[0]}/workspace", json=body).json() == {"saved": True}
    saved = browser.get(f"/api/exercises/{exercise_ids[0]}/workspace").json()
    assert {key: saved[key] for key in body} == body
    assert saved["updated_at"] is not None


def test_saving_only_draft_keeps_latest_run(learner, exercise_ids):
    browser, _, _ = learner
    path = f"/api/exercises/{exercise_ids[2]}/workspace"
    browser.put(path, json={"draft_code": "v1", "latest_run_code": "run-v1", "latest_run_result": {"status": "ok"}})
    browser.put(path, json={"draft_code": "v2"})
    saved = browser.get(path).json()
    assert (saved["draft_code"], saved["latest_run_code"], saved["latest_run_result"]) == ("v2", "run-v1", {"status": "ok"})


def test_workspace_is_private_to_each_user(exercise_ids):
    owner, _, _ = signed_in()
    other, _, _ = signed_in()
    path = f"/api/exercises/{exercise_ids[3]}/workspace"
    owner.put(path, json={"draft_code": "owner secret draft"})
    assert other.get(path).json() == EMPTY_WORKSPACE
    other.put(path, json={"draft_code": "other draft"})
    assert owner.get(path).json()["draft_code"] == "owner secret draft"


@pytest.mark.parametrize("method", ["GET", "PUT"])
def test_workspace_for_unknown_exercise_returns_404(learner, method):
    browser, _, _ = learner
    response = browser.request(method, "/api/exercises/999999/workspace", json={"draft_code": "x"} if method == "PUT" else None)
    assert response.status_code == 404


def test_workspace_rejects_oversized_draft(learner, exercise_ids):
    browser, _, _ = learner
    response = browser.put(f"/api/exercises/{exercise_ids[0]}/workspace", json={"draft_code": "x" * 100_001})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Lesson code-challenge progress
# ---------------------------------------------------------------------------

def test_anonymous_challenge_progress_is_empty(db, lesson_challenge):
    lesson_id, _ = lesson_challenge
    assert client().get(f"/api/lessons/{lesson_id}/challenge-progress").json() == {"completed_challenge_ids": []}


def test_completing_a_challenge_requires_login(db, lesson_challenge):
    lesson_id, challenge_id = lesson_challenge
    assert client().put(f"/api/lessons/{lesson_id}/challenges/{challenge_id}/progress").status_code == 401


def test_completing_a_challenge_is_idempotent_and_listed(learner, lesson_challenge):
    browser, _, _ = learner
    lesson_id, challenge_id = lesson_challenge
    path = f"/api/lessons/{lesson_id}/challenges/{challenge_id}/progress"
    first = browser.put(path).json()["progress"]
    second = browser.put(path).json()["progress"]
    assert first["challenge_id"] == challenge_id and second["completed_at"] == first["completed_at"]
    assert browser.get(f"/api/lessons/{lesson_id}/challenge-progress").json() == {"completed_challenge_ids": [challenge_id]}
    assert browser.get("/api/progress").json()["completed_lesson_challenges"] == 1


def test_challenge_progress_is_private_to_each_user(lesson_challenge):
    owner, _, _ = signed_in()
    other, _, _ = signed_in()
    lesson_id, challenge_id = lesson_challenge
    owner.put(f"/api/lessons/{lesson_id}/challenges/{challenge_id}/progress")
    assert other.get(f"/api/lessons/{lesson_id}/challenge-progress").json() == {"completed_challenge_ids": []}


@pytest.mark.parametrize("target", ["unknown_lesson", "unknown_challenge"])
def test_completing_unknown_challenge_returns_404(learner, lesson_challenge, target):
    browser, _, _ = learner
    lesson_id, challenge_id = lesson_challenge
    path = f"/api/lessons/999999/challenges/{challenge_id}/progress" if target == "unknown_lesson" \
        else f"/api/lessons/{lesson_id}/challenges/not-a-real-challenge/progress"
    assert browser.put(path).status_code == 404
