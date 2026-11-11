import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql://codora:codora-local@localhost:5432/codora")
os.environ.setdefault("JWT_SECRET", "test-only-jwt-secret-with-32-characters")

from fastapi.testclient import TestClient

from app.auth import current_user_id, hash_password, make_token, verify_password
from app.main import app
from app.schemas import ChatInput, ProgressInput


def test_password_hash_is_argon2id_and_verifies():
    password = "this-is-a-strong-test-password"
    encoded = hash_password(password)
    assert encoded.startswith("$argon2id$")
    assert verify_password(password, encoded)
    assert not verify_password("wrong-password", encoded)


def test_registration_rejects_weak_password_and_username():
    body = {"email": "learner@example.com", "username": "x", "password": "short", "full_name": "Learner"}
    response = TestClient(app).post("/api/auth/register", json=body)
    assert response.status_code == 422


def test_user_routes_require_authentication():
    response = TestClient(app).get("/api/progress")
    assert response.status_code == 401


def test_request_schemas_reject_invalid_progress_and_chat_roles():
    try:
        ProgressInput(item_type="bookmark", item_id="lesson-1", status="completed")
        assert False, "invalid item_type should be rejected"
    except ValueError:
        pass
    try:
        ChatInput(role="system", message="persist this")
        assert False, "unsupported chat role should be rejected"
    except ValueError:
        pass


def test_schema_has_exactly_six_application_tables_and_original_keys():
    sql = (Path(__file__).parents[1] / "migrations" / "001_initial_schema.sql").read_text(encoding="utf-8")
    tables = [line.split()[5] for line in sql.splitlines() if line.strip().startswith("CREATE TABLE IF NOT EXISTS")]
    assert set(tables) == {"users", "courses", "lessons", "exercises", "user_progress", "ai_chats"}
    assert "id UUID PRIMARY KEY" in sql
    assert "id VARCHAR(120) PRIMARY KEY" in sql
    assert "test_cases JSONB" in sql and "hints JSONB" in sql and "tags JSONB" in sql
    assert "conversation_id" not in sql and "lesson_id VARCHAR(120) REFERENCES exercises" not in sql


def test_session_token_contains_user_id():
    user_id = "c5232f9b-4efe-44a5-8a27-a5d3c5f875f5"
    token = make_token(user_id, "learner@example.com")
    assert current_user_id(token) == user_id
