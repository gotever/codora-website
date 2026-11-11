import os
from pathlib import Path
import subprocess
import sys
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason="Set TEST_DATABASE_URL to an isolated local database ending in _test")
MIGRATION = (Path(__file__).parents[1] / "migrations" / "001_initial_schema.sql").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def db():
    assert TEST_DATABASE_URL
    db_name = TEST_DATABASE_URL.rsplit("/", 1)[-1].split("?", 1)[0]
    if not db_name.endswith("_test"):
        pytest.fail("Refusing to run destructive migration tests unless database name ends with _test")
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        conn.execute("DROP TABLE IF EXISTS ai_chats,user_progress,exercises,lessons,courses,users CASCADE")
        conn.execute(MIGRATION)
        conn.commit()
        yield conn
        conn.execute("DROP TABLE IF EXISTS ai_chats,user_progress,exercises,lessons,courses,users CASCADE")


def test_required_tables_columns_and_key_types(db):
    tables = {row[0] for row in db.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")}
    assert {"users", "courses", "lessons", "exercises", "user_progress", "ai_chats"} <= tables
    types = dict(db.execute("""SELECT table_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND column_name='id'"""))
    assert types["users"] == types["user_progress"] == types["ai_chats"] == "uuid"
    assert types["courses"] == types["lessons"] == types["exercises"] == "character varying"


def test_unique_users_foreign_keys_jsonb_progress_upsert_and_deletion(db):
    user = db.execute("INSERT INTO users(email,username,password_hash,full_name) VALUES('db-test@example.com','db-test','hash','Test User') RETURNING id").fetchone()[0]
    course = "db-test-course"
    lesson = "db-test-lesson"
    exercise = "db-test-exercise"
    db.execute("INSERT INTO courses(id,title,order_index) VALUES(%s,'Test Course',900)", (course,))
    db.execute("INSERT INTO lessons(id,title,course_id,order_index) VALUES(%s,'Test Lesson',%s,900)", (lesson,course))
    db.execute("""INSERT INTO exercises(id,lesson_id,title,difficulty,function_name,test_cases,hints,tags)
      VALUES(%s,%s,'Test Exercise','Easy','identity',%s,%s,%s)""", (exercise,lesson,'[{"input": 1}]','["hint"]','["test"]'))
    assert db.execute("SELECT test_cases->0->>'input' FROM exercises WHERE id=%s", (exercise,)).fetchone()[0] == "1"
    with pytest.raises(psycopg.errors.UniqueViolation):
        with db.transaction():
            db.execute("INSERT INTO users(email,username,password_hash,full_name) VALUES('db-test@example.com','other','hash','Test')")
    db.execute("INSERT INTO user_progress(user_id,item_type,item_id,status) VALUES(%s,'exercise',%s,'in_progress')", (user,exercise))
    progress = db.execute("""INSERT INTO user_progress(user_id,item_type,item_id,status,completed_at)
      VALUES(%s,'exercise',%s,'completed',now()) ON CONFLICT(user_id,item_type,item_id)
      DO UPDATE SET status=EXCLUDED.status,completed_at=EXCLUDED.completed_at RETURNING status""", (user,exercise)).fetchone()[0]
    assert progress == "completed"
    db.execute("INSERT INTO ai_chats(user_id,exercise_id,role,message) VALUES(%s,%s,'user','hello')", (user,exercise))
    db.execute("DELETE FROM exercises WHERE id=%s", (exercise,))
    assert db.execute("SELECT exercise_id FROM ai_chats WHERE user_id=%s", (user,)).fetchone()[0] is None
    db.execute("DELETE FROM users WHERE id=%s", (user,))
    assert db.execute("SELECT count(*) FROM user_progress").fetchone()[0] == 0
    db.execute("DELETE FROM courses WHERE id=%s", (course,))
    assert db.execute("SELECT count(*) FROM lessons WHERE id=%s", (lesson,)).fetchone()[0] == 0


def test_api_auth_content_progress_chat_and_owner_isolation(db):
    course_id, lesson_id, exercise_id = "api-test-course", "api-test-lesson", "api-test-exercise"
    db.execute("INSERT INTO courses(id,title,order_index) VALUES(%s,'API Test Course',901)", (course_id,))
    db.execute("INSERT INTO lessons(id,title,course_id,order_index) VALUES(%s,'API Test Lesson',%s,901)", (lesson_id,course_id))
    db.execute("INSERT INTO exercises(id,lesson_id,title,difficulty,function_name) VALUES(%s,%s,'API Test Exercise','Easy','identity')", (exercise_id,lesson_id))
    db.commit()

    suffix = uuid4().hex
    user_body = {"email": f"{suffix}@example.com", "username": f"user_{suffix[:12]}", "password": "a-secure-test-password", "full_name": "API Test"}
    second_body = {"email": f"other-{suffix}@example.com", "username": f"other_{suffix[:12]}", "password": "a-secure-test-password", "full_name": "Other User"}
    with TestClient(__import__("app.main", fromlist=["app"]).app) as client:
        assert client.get("/api/courses").status_code == 200
        assert client.get(f"/api/lessons/{lesson_id}").json()["lesson"]["title"] == "API Test Lesson"
        assert client.get("/api/exercises").json()["exercises"][0]["id"] == exercise_id

        response = client.post("/api/auth/register", json=user_body)
        assert response.status_code == 201
        assert "password_hash" not in response.json()["user"]
        assert response.cookies.get("codora_session")
        assert client.post("/api/auth/register", json=user_body).status_code == 409
        assert client.get("/api/auth/me").json()["user"]["email"] == user_body["email"]
        assert client.post("/api/auth/login", json={"email": user_body["email"], "password": "incorrect-password"}).status_code == 401
        assert client.post("/api/auth/login", json={"email": user_body["email"], "password": user_body["password"]}).status_code == 200

        assert client.put("/api/progress", json={"item_type": "bookmark", "item_id": lesson_id, "status": "completed"}).status_code == 422
        assert client.put("/api/progress", json={"item_type": "lesson", "item_id": "missing", "status": "completed"}).status_code == 404
        first = client.put("/api/progress", json={"item_type": "exercise", "item_id": exercise_id, "status": "in_progress"}).json()["progress"]
        updated = client.put("/api/progress", json={"item_type": "exercise", "item_id": exercise_id, "status": "completed"}).json()["progress"]
        assert first["id"] == updated["id"] and updated["completed_at"]
        assert len(client.get("/api/progress").json()["progress"]) == 1

        chat = client.post("/api/chats", json={"exercise_id": exercise_id, "role": "user", "message": "help", "code_snapshot": "print(1)"})
        assert chat.status_code == 201
        assert client.get(f"/api/chats?exercise_id={exercise_id}").json()["messages"][0]["code_snapshot"] == "print(1)"
        assert client.post("/api/chats", json={"exercise_id": "missing", "role": "user", "message": "help"}).status_code == 404

        other = client.post("/api/auth/register", json=second_body)
        assert other.status_code == 201
        assert client.get(f"/api/chats?exercise_id={exercise_id}").json()["messages"] == []
        assert client.get("/api/progress").json()["progress"] == []
        assert client.post("/api/auth/logout").status_code == 200


def test_curriculum_seed_is_idempotent(db):
    backend = Path(__file__).parents[1]
    env = os.environ.copy()

    def run_seed():
        result = subprocess.run(
            [sys.executable, "-m", "app.seed"],
            cwd=backend,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr
        assert "Seeded 2 courses, 12 lessons, and 4 exercises." in result.stdout

    def snapshot():
        return {
            table: db.execute(f"SELECT to_jsonb(row_data) FROM {table} AS row_data ORDER BY id").fetchall()
            for table in ("courses", "lessons", "exercises")
        }

    run_seed()
    first = snapshot()
    run_seed()
    second = snapshot()

    assert first == second
    assert {
        "sum-of-even-numbers",
        "reverse-a-string",
        "count-vowels",
        "find-maximum",
    } <= {row[0]["id"] for row in second["exercises"]}
