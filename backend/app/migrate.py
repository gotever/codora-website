from pathlib import Path

from .db import connection, pool

MIGRATION = Path(__file__).resolve().parents[1] / "migrations" / "001_initial_schema.sql"
REQUIRED_COLUMNS = {
    "users": {"id", "email", "username", "password_hash", "full_name", "created_at"},
    "courses": {"id", "title", "description", "order_index"},
    "lessons": {"id", "title", "course_id", "content_markdown", "order_index"},
    "exercises": {"id", "lesson_id", "title", "difficulty", "description", "function_name", "starter_code", "test_cases", "hints", "tags"},
    "user_progress": {"id", "user_id", "item_type", "item_id", "status", "completed_at"},
    "ai_chats": {"id", "user_id", "exercise_id", "role", "message", "code_snapshot", "created_at"},
}


def main() -> None:
    pool.open()
    try:
        if "--status" in __import__("sys").argv:
            with connection() as conn:
                rows = conn.execute("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'").fetchall()
            present: dict[str, set[str]] = {}
            for row in rows:
                present.setdefault(row["table_name"], set()).add(row["column_name"])
            missing = [f"{table} ({', '.join(sorted(columns - present.get(table, set())))})"
                       for table, columns in REQUIRED_COLUMNS.items() if columns - present.get(table, set())]
            if missing:
                print("Pending schema; missing: " + "; ".join(missing))
                raise SystemExit(1)
            print("Schema is up to date (six tables and required columns present).")
            return
        with connection() as conn:
            conn.execute("SELECT pg_advisory_xact_lock(73190421)")
            conn.execute(MIGRATION.read_text(encoding="utf-8"))
        print("Applied idempotent migration 001_initial_schema.sql")
    finally:
        pool.close()


if __name__ == "__main__":
    main()
