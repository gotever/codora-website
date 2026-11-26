"""Extra unit tests for app/auth.py (passwords, session tokens) and app/schemas.py (request validation).

No database and no OpenAI: protected routes are only called without a valid session, so the
request is rejected by the auth dependency before any SQL runs. Known defects are xfail(strict=True)
with their bug ID from docs/testing/.
"""
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.auth import current_user_id, hash_password, make_token, optional_current_user_id, verify_password
from app.main import app
from app.schemas import (
    ChatInput,
    ExerciseWorkspaceInput,
    LearningPreferences,
    LoginInput,
    PersonalizeLessonInput,
    ProgressInput,
    RegisterInput,
    SubmitInput,
    TutorChatInput,
    UserLevelInput,
)
from app.settings import settings

USER_ID = "c5232f9b-4efe-44a5-8a27-a5d3c5f875f5"
client = TestClient(app)


def signed(payload, secret=None, algorithm="HS256"):
    return jwt.encode(payload, secret or settings.jwt_secret, algorithm=algorithm)


def now():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------

def test_same_password_hashes_differently_each_time():
    first, second = hash_password("same-password-123"), hash_password("same-password-123")
    assert first != second
    assert verify_password("same-password-123", first) and verify_password("same-password-123", second)


def test_hash_never_contains_the_plain_password():
    assert "plain-secret-value" not in hash_password("plain-secret-value")


@pytest.mark.parametrize("password", ["mật-khẩu-tiếng-việt-123", "pässwörd with spaces ✓", "x" * 128])
def test_unicode_and_long_passwords_round_trip(password):
    assert verify_password(password, hash_password(password))


@pytest.mark.parametrize("attempt", ["", "Correct-horse-battery", "correct-horse-battery ", " correct-horse-battery"])
def test_password_verification_is_exact(attempt):
    assert not verify_password(attempt, hash_password("correct-horse-battery"))


@pytest.mark.xfail(strict=True, reason="BUG-05: verify_password raises argon2 InvalidHashError on a malformed stored hash instead of returning False")
@pytest.mark.parametrize("stored_hash", ["", "not-a-hash"])
def test_verify_password_with_malformed_hash_returns_false(stored_hash):
    assert verify_password("any-password-123", stored_hash) is False


def test_verify_password_with_truncated_argon2_hash_returns_false():
    assert verify_password("any-password-123", "$argon2id$broken") is False


# ---------------------------------------------------------------------------
# Session tokens
# ---------------------------------------------------------------------------

def test_make_token_payload_and_header():
    token = make_token(USER_ID, "learner@example.com")
    assert jwt.get_unverified_header(token)["alg"] == "HS256"
    payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    assert payload["sub"] == USER_ID
    assert payload["email"] == "learner@example.com"
    assert payload["exp"] - payload["iat"] == 7 * 24 * 3600


def test_make_token_expiry_is_about_seven_days_from_now():
    payload = jwt.decode(make_token(USER_ID, "a@example.com"), settings.jwt_secret, algorithms=["HS256"])
    remaining = payload["exp"] - now().timestamp()
    assert 7 * 24 * 3600 - 60 < remaining <= 7 * 24 * 3600


def test_current_user_id_normalizes_uuid_case():
    token = signed({"sub": USER_ID.upper(), "exp": now() + timedelta(hours=1)})
    assert current_user_id(token) == USER_ID


INVALID_TOKENS = {
    "missing": None,
    "empty": "",
    "garbage": "not-a-jwt",
    "expired": lambda: signed({"sub": USER_ID, "exp": now() - timedelta(seconds=1)}),
    "wrong_secret": lambda: signed({"sub": USER_ID, "exp": now() + timedelta(hours=1)}, secret="another-secret-with-32-characters!!"),
    "alg_none": lambda: jwt.encode({"sub": USER_ID}, key=None, algorithm="none"),
    "hs512": lambda: signed({"sub": USER_ID, "exp": now() + timedelta(hours=1)}, algorithm="HS512"),
    "missing_sub": lambda: signed({"email": "a@example.com", "exp": now() + timedelta(hours=1)}),
    "sub_not_uuid": lambda: signed({"sub": "admin", "exp": now() + timedelta(hours=1)}),
    "tampered": lambda: make_token(USER_ID, "a@example.com")[:-2] + "AA",
}


def build_token(name):
    value = INVALID_TOKENS[name]
    return value() if callable(value) else value


@pytest.mark.parametrize("name", sorted(INVALID_TOKENS))
def test_current_user_id_rejects_invalid_tokens_with_401(name):
    with pytest.raises(HTTPException) as error:
        current_user_id(build_token(name))
    assert error.value.status_code == 401
    assert error.value.detail == "Authentication required"


def test_tampered_payload_with_original_signature_is_rejected():
    header, _payload, signature = make_token(USER_ID, "a@example.com").split(".")
    forged_payload = jwt.utils.base64url_encode(f'{{"sub":"{uuid4()}"}}'.encode()).decode()
    with pytest.raises(HTTPException):
        current_user_id(f"{header}.{forged_payload}.{signature}")


def test_optional_user_is_none_without_cookie():
    assert optional_current_user_id(None) is None
    assert optional_current_user_id("") is None


def test_optional_user_accepts_valid_token():
    assert optional_current_user_id(make_token(USER_ID, "a@example.com")) == USER_ID


def test_optional_user_rejects_invalid_token_instead_of_falling_back_to_anonymous():
    with pytest.raises(HTTPException) as error:
        optional_current_user_id(build_token("expired"))
    assert error.value.status_code == 401


# ---------------------------------------------------------------------------
# Protected routes reject requests without a valid session (no DB is reached)
# ---------------------------------------------------------------------------

PROTECTED_ROUTES = [
    ("GET", "/api/auth/me", None),
    ("PUT", "/api/auth/level", {"level": "beginner"}),
    ("PUT", "/api/auth/learning-preferences", {"explanation_style": "direct"}),
    ("GET", "/api/progress", None),
    ("PUT", "/api/progress", {"item_type": "lesson", "item_id": 1, "status": "completed"}),
    ("POST", "/api/chats", {"role": "user", "message": "hi"}),
    ("POST", "/api/tutor/chat", {"context_type": "lesson", "context_id": 1, "message": "hi"}),
    ("GET", "/api/exercises/1/workspace", None),
    ("GET", "/api/exercises/1/submissions", None),
]


@pytest.mark.parametrize("method,path,body", PROTECTED_ROUTES)
@pytest.mark.parametrize("token_name", ["missing", "expired", "wrong_secret", "alg_none"])
def test_protected_route_returns_401_without_valid_session(method, path, body, token_name):
    token = build_token(token_name)
    cookies = {"codora_session": token} if token else None
    response = TestClient(app, cookies=cookies).request(method, path, json=body)
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}


def test_chats_anonymous_gets_empty_list_without_db():
    response = client.get("/api/chats")
    assert response.status_code == 200
    assert response.json() == {"messages": []}


@pytest.mark.parametrize("token_name", ["expired", "wrong_secret", "alg_none"])
def test_chats_with_invalid_session_returns_401(token_name):
    response = TestClient(app, cookies={"codora_session": build_token(token_name)}).get("/api/chats")
    assert response.status_code == 401


def test_logout_clears_session_cookie():
    response = client.post("/api/auth/logout")
    assert response.status_code == 200
    assert response.json() == {"success": True}
    set_cookie = response.headers["set-cookie"].lower()
    assert set_cookie.startswith("codora_session=")
    assert "max-age=0" in set_cookie
    assert "httponly" in set_cookie and "samesite=lax" in set_cookie and "path=/" in set_cookie


# ---------------------------------------------------------------------------
# Validation errors never echo user input (passwords)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("path,body", [
    ("/api/auth/register", {"email": "bad", "username": "ok_user", "password": "SuperSecretValue#1", "full_name": "A"}),
    ("/api/auth/register", {"email": "a@example.com", "username": "x", "password": "short-Secret", "full_name": "A"}),
    ("/api/auth/login", {"email": "not-an-email", "password": "SuperSecretValue#1"}),
])
def test_validation_error_is_generic_and_does_not_echo_password(path, body):
    response = client.post(path, json=body)
    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request input"}
    assert body["password"] not in response.text


def test_malformed_json_body_is_rejected_with_generic_422():
    response = client.post("/api/auth/login", content="{not json", headers={"content-type": "application/json"})
    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request input"}


# ---------------------------------------------------------------------------
# RegisterInput / LoginInput
# ---------------------------------------------------------------------------

VALID_REGISTER = {"email": "learner@example.com", "username": "learner_01", "password": "x" * 12, "full_name": "Learner"}


def register(**changes):
    return RegisterInput(**{**VALID_REGISTER, **changes})


def test_register_valid_input_and_default_level():
    assert register().level == "beginner"


@pytest.mark.parametrize("username", ["abc", "a" * 64, "user.name-1_x", "ABC123"])
def test_register_accepts_valid_usernames(username):
    assert register(username=username).username == username


@pytest.mark.parametrize("username", ["ab", "a" * 65, "has space", "huy.đinh", "abc\n", "a/b", "<script>", ""])
def test_register_rejects_invalid_usernames(username):
    with pytest.raises(ValidationError):
        register(username=username)


@pytest.mark.parametrize("password,ok", [("x" * 11, False), ("x" * 12, True), ("x" * 128, True), ("x" * 129, False)])
def test_register_password_length_boundaries(password, ok):
    if ok:
        assert register(password=password).password == password
    else:
        with pytest.raises(ValidationError):
            register(password=password)


@pytest.mark.parametrize("full_name,ok", [("", False), ("A", True), ("A" * 160, True), ("A" * 161, False)])
def test_register_full_name_length_boundaries(full_name, ok):
    if ok:
        assert register(full_name=full_name).full_name == full_name
    else:
        with pytest.raises(ValidationError):
            register(full_name=full_name)


@pytest.mark.parametrize("email", ["plainaddress", "@example.com", "a@", "a b@example.com", ""])
def test_register_rejects_invalid_emails(email):
    with pytest.raises(ValidationError):
        register(email=email)


@pytest.mark.parametrize("level", ["beginner", "intermediate", "advanced"])
def test_register_accepts_known_levels(level):
    assert register(level=level).level == level


@pytest.mark.parametrize("level", ["expert", "Beginner", ""])
def test_register_rejects_unknown_levels(level):
    with pytest.raises(ValidationError):
        register(level=level)


@pytest.mark.parametrize("password,ok", [("", False), ("x", True), ("x" * 128, True), ("x" * 129, False)])
def test_login_password_length_boundaries(password, ok):
    if ok:
        LoginInput(email="a@example.com", password=password)
    else:
        with pytest.raises(ValidationError):
            LoginInput(email="a@example.com", password=password)


# ---------------------------------------------------------------------------
# ProgressInput / UserLevelInput / LearningPreferences / PersonalizeLessonInput
# ---------------------------------------------------------------------------

def progress(**changes):
    return ProgressInput(**{"item_type": "exercise", "item_id": 1, "status": "completed", **changes})


@pytest.mark.parametrize("score", [None, 0, 0.0, 5.5, 10])
def test_progress_accepts_scores_in_range(score):
    assert progress(score=score).score == score


@pytest.mark.parametrize("score", [-0.1, 10.01, 100, float("nan"), "ten"])
def test_progress_rejects_scores_out_of_range(score):
    with pytest.raises(ValidationError):
        progress(score=score)


@pytest.mark.parametrize("item_id", [0, -1, 1.5, "abc"])
def test_progress_rejects_non_positive_or_non_integer_item_id(item_id):
    with pytest.raises(ValidationError):
        progress(item_id=item_id)


def test_progress_coerces_numeric_string_item_id():
    assert progress(item_id="42").item_id == 42


@pytest.mark.parametrize("status", ["not_started", "in_progress", "completed"])
def test_progress_accepts_known_statuses(status):
    assert progress(status=status).status == status


@pytest.mark.parametrize("status", ["done", "COMPLETED", ""])
def test_progress_rejects_unknown_statuses(status):
    with pytest.raises(ValidationError):
        progress(status=status)


@pytest.mark.parametrize("level", ["expert", None])
def test_user_level_rejects_unknown_level(level):
    with pytest.raises(ValidationError):
        UserLevelInput(level=level)


def test_learning_preferences_default_to_none():
    assert LearningPreferences().model_dump() == {"explanation_style": None, "detail_level": None, "hint_preference": None}


@pytest.mark.parametrize("field,value", [
    ("explanation_style", "socratic"), ("detail_level", "verbose"), ("hint_preference", "maximal"),
])
def test_learning_preferences_reject_unknown_values(field, value):
    with pytest.raises(ValidationError):
        LearningPreferences(**{field: value})


@pytest.mark.parametrize("value,ok", [(0, True), (1000, True), (-1, False), (1001, False)])
def test_personalize_consecutive_errors_boundaries(value, ok):
    if ok:
        assert PersonalizeLessonInput(consecutive_errors=value).consecutive_errors == value
    else:
        with pytest.raises(ValidationError):
            PersonalizeLessonInput(consecutive_errors=value)


# ---------------------------------------------------------------------------
# Code / chat payload size limits
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("code,ok", [("", False), ("x", True), ("x" * 100_000, True), ("x" * 100_001, False)])
def test_submit_code_length_boundaries(code, ok):
    if ok:
        SubmitInput(code=code)
    else:
        with pytest.raises(ValidationError):
            SubmitInput(code=code)


def test_workspace_limits():
    ExerciseWorkspaceInput(draft_code="", latest_run_code=None, latest_run_result=None)
    ExerciseWorkspaceInput(draft_code="x" * 100_000, latest_run_code="y" * 100_000, latest_run_result={"status": "ok"})
    for changes in ({"draft_code": "x" * 100_001}, {"draft_code": "", "latest_run_code": "y" * 100_001}, {"draft_code": "", "latest_run_result": "ok"}):
        with pytest.raises(ValidationError):
            ExerciseWorkspaceInput(**changes)


@pytest.mark.parametrize("message,ok", [("", False), ("x", True), ("x" * 20_000, True), ("x" * 20_001, False)])
def test_chat_message_length_boundaries(message, ok):
    for model, extra in ((ChatInput, {"role": "user"}), (TutorChatInput, {"context_type": "exercise", "context_id": 1})):
        if ok:
            model(message=message, **extra)
        else:
            with pytest.raises(ValidationError):
                model(message=message, **extra)


@pytest.mark.parametrize("exercise_id", [0, -5])
def test_chat_rejects_non_positive_exercise_id(exercise_id):
    with pytest.raises(ValidationError):
        ChatInput(exercise_id=exercise_id, role="user", message="hi")


def tutor_input(**changes):
    return TutorChatInput(**{"context_type": "lesson", "context_id": 1, "message": "hi", **changes})


@pytest.mark.parametrize("changes", [
    {"context_type": "course"},
    {"context_id": 0},
    {"code_snapshot": "x" * 100_001},
    {"activity": "x" * 8_001},
    {"challenge_context": {"id": 1}},
    {"challenge_context": ["id"]},
])
def test_tutor_chat_input_rejects_invalid_fields(changes):
    with pytest.raises(ValidationError):
        tutor_input(**changes)


def test_tutor_chat_input_accepts_limits_and_string_challenge_context():
    body = tutor_input(code_snapshot="x" * 100_000, activity="y" * 8_000, challenge_context={"id": "c1", "title": "T"})
    assert body.challenge_context == {"id": "c1", "title": "T"}
