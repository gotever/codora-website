# FastAPI backend

The API is Python 3.10+ / FastAPI with psycopg 3 connection pooling. PostgreSQL 16 is the supported local version. Use parameterized SQL; there is no ORM and no extra database table beyond the requested six.

Use a PostgreSQL database with `UTF8` server encoding. Curriculum markdown contains Unicode characters that cannot be stored in legacy encodings such as `WIN1252`; the seed checks the encoding before writing.

## Setup

From the repository root, copy `.env.example` to `.env` and set local values. Copy this directory's `.env.example` to `backend/.env`; set `DATABASE_URL` and `JWT_SECRET` to match the root environment. Never use a production database for development or tests.

```powershell
docker compose up -d
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m app.migrate
node --experimental-strip-types scripts/export_curriculum.mjs
python -m app.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 3001
```

`python -m app.migrate --status` checks all six tables and required columns. Migration `001_initial_schema.sql` is idempotent and guarded with a PostgreSQL advisory transaction lock. No migration ledger table is created, preserving the six-table cap. Add future numbered, idempotent SQL files and extend the runner/status checks when the schema evolves.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for this local database |
| `API_HOST`, `API_PORT` | Uvicorn bind address and port |
| `JWT_SECRET` | Private signing secret, at least 32 characters |
| `COOKIE_SECURE` | Set `true` behind HTTPS; `false` for local HTTP |
| `FRONTEND_ORIGIN` | Exact allowed browser origin for credentialed CORS |

## API

Public content and health:

- `GET /api/health`
- `GET /api/courses`, `GET /api/courses/{id}`, `GET /api/courses/{id}/lessons`
- `GET /api/lessons/{id}`, `GET /api/lessons/{id}/exercises`
- `GET /api/exercises`, `GET /api/exercises/{id}`

Authentication and owned data:

- `POST /api/auth/register` (`email`, `username`, `password`, `full_name`)
- `POST /api/auth/login` (`email`, `password`), `POST /api/auth/logout`, `GET /api/auth/me`
- `GET /api/progress`, `PUT /api/progress` (`item_type`, `item_id`, `status`)
- `GET /api/chats?exercise_id=...`, `POST /api/chats` (`exercise_id`, `role`, `message`, `code_snapshot`)

Registration and login set a signed, seven-day, HTTP-only, SameSite=Lax cookie. The API never returns `password_hash`. Course and exercise browsing is public. Progress and chat routes require the cookie and scope reads/writes to its user ID.

## Schema and limits

```mermaid
erDiagram
  USERS ||--o{ USER_PROGRESS : owns
  USERS ||--o{ AI_CHATS : owns
  COURSES ||--o{ LESSONS : contains
  LESSONS ||--o{ EXERCISES : contains
  EXERCISES o|--o{ AI_CHATS : context
  USERS { uuid id PK }
  COURSES { varchar id PK }
  LESSONS { varchar id PK; varchar course_id FK; text content_markdown }
  EXERCISES { varchar id PK; varchar lesson_id FK; jsonb test_cases; jsonb hints; jsonb tags }
  USER_PROGRESS { uuid id PK; uuid user_id FK; varchar item_type; varchar item_id }
  AI_CHATS { uuid id PK; uuid user_id FK; varchar exercise_id FK; text message }
```

`USER_PROGRESS.item_id` is polymorphic and validated in the service. Chat rows have no conversation ID or lesson ID; null exercise chat history therefore aggregates lesson chats. The six-table schema has no storage for drafts, bookmarks, submission history, or unlocked hints. JSONB exercise test cases are readable by browsers and are not authoritative grading secrets.

The two source curricula use overlapping numeric lesson IDs for different titles. The export preserves both datasets; seeded route lessons use the 12-entry detailed curriculum, and the eight-lesson Learning card remains a client fallback. Exercise-to-lesson assignments are heuristic because `exercises.ts` has no canonical lesson IDs: `reverse-a-string` and `count-vowels` are currently assigned to detailed lesson `3` (`Operators & expressions`), while `sum-of-even-numbers` and `find-maximum` are assigned to lesson `7` (`Loops & iteration`). All four source exercises declare course `python-fundamentals`, while the seeded lessons belong to `python-foundations`. These relationships are not confirmed by the source data; get product-owner mapping approval before changing IDs, navigation, or the seed assignments.

## Tests

Run `pytest` for API validation, authentication primitive, and schema-shape checks. Run migrations against an isolated local PostgreSQL database for database integration tests; do not point tests at production.
