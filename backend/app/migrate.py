from pathlib import Path

from .db import connection, pool

MIGRATIONS = [
    Path(__file__).resolve().parents[1] / "migrations" / "001_initial_schema.sql",
    Path(__file__).resolve().parents[1] / "migrations" / "002_numeric_course_ids.sql",
    Path(__file__).resolve().parents[1] / "migrations" / "003_drop_course_slug.sql",
    Path(__file__).resolve().parents[1] / "migrations" / "004_numeric_lesson_exercise_ids.sql",
    Path(__file__).resolve().parents[1] / "migrations" / "005_learner_ability.sql",
    Path(__file__).resolve().parents[1] / "migrations" / "006_ai_tutor_memory.sql",
]
REQUIRED_COLUMNS = {
    "users": {"id", "email", "username", "password_hash", "full_name", "created_at", "level", "ai_tutor_memory"},
    "courses": {"id", "title", "description", "order_index"},
    "lessons": {"id", "title", "course_id", "content_markdown", "order_index"},
    "exercises": {"id", "lesson_id", "title", "difficulty", "description", "function_name", "starter_code", "test_cases", "hints", "tags"},
    "user_progress": {"id", "user_id", "item_type", "item_id", "status", "completed_at", "score", "last_attempt_at"},
    "ai_chats": {"id", "user_id", "exercise_id", "role", "message", "code_snapshot", "context_key", "event_type", "created_at"},
}


def main() -> None:
    pool.open()
    try:
        if "--status" in __import__("sys").argv:
            with connection() as conn:
                rows = conn.execute("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'").fetchall()
            present: dict[str, set[str]] = {}
            for row in rows:
                present.setdefault(row["table_name"], set()).add(row["column_name"])
            missing = [f"{table} ({', '.join(sorted(columns - present.get(table, set())))})"
                       for table, columns in REQUIRED_COLUMNS.items() if columns - present.get(table, set())]
            actual_types = {
                (row["table_name"], row["column_name"]): row["data_type"]
                for row in rows
            }
            if missing:
                print("Pending schema; missing: " + "; ".join(missing))
                raise SystemExit(1)
            if any(actual_types.get((table, column)) != "bigint" for table, column in (
                ("courses", "id"), ("lessons", "id"), ("lessons", "course_id"),
                ("exercises", "id"), ("exercises", "lesson_id"),
                ("user_progress", "item_id"), ("ai_chats", "exercise_id"),
            )):
                print("Pending schema; all curriculum IDs and references must be bigint.")
                raise SystemExit(1)
            print("Schema is up to date (six tables and required columns present).")
            return
        with connection() as conn:
            conn.execute("SELECT pg_advisory_xact_lock(73190421)")
            for migration in MIGRATIONS:
                conn.execute(migration.read_text(encoding="utf-8"))
        print("Applied idempotent migrations 001_initial_schema.sql through 006_ai_tutor_memory.sql")
    finally:
        pool.close()


if __name__ == "__main__":
    main()
