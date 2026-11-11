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

`python -m app.migrate --status` checks all six tables, required columns, and numeric curriculum identifiers. Migrations `001_initial_schema.sql` through `005_learner_ability.sql` are idempotent and run under a PostgreSQL advisory transaction lock. Migration 002 converts course keys, migration 004 converts lesson/exercise keys and references, and migration 005 adds learner level and latest exercise score fields without adding tables. Migration 003 removes the temporary course slug. No migration ledger table is created. Add future numbered, idempotent SQL files and extend the runner/status checks when the schema evolves.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string for this local database |
| `API_HOST`, `API_PORT` | Uvicorn bind address and port |
| `JWT_SECRET` | Private signing secret, at least 32 characters |
| `OPENAI_API_KEY` | OpenAI API key used only by FastAPI; fill in the placeholder in `backend/.env` |
| `OPENAI_MODEL` | OpenAI model for lesson rewrites; defaults to `gpt-6-luna` |
| `COOKIE_SECURE` | Set `true` behind HTTPS; `false` for local HTTP |
| `FRONTEND_ORIGIN` | Exact allowed browser origin for credentialed CORS |

## API

Public content and health:

- `GET /api/health`
- `GET /api/courses`, `GET /api/courses/{id}`, `GET /api/courses/{id}/lessons`
- `GET /api/lessons/{id}`, `GET /api/lessons/{id}/exercises`
- `POST /api/lessons/{id}/personalize` (`consecutive_errors` optional; uses the signed-in learner profile when available)
- `GET /api/exercises`, `GET /api/exercises/{id}`

Authentication and owned data:

- `POST /api/auth/register` (`email`, `username`, `password`, `full_name`, optional `level`)
- `POST /api/auth/login` (`email`, `password`), `POST /api/auth/logout`, `GET /api/auth/me`
- `PUT /api/auth/level` (`level`: `beginner`, `intermediate`, or `advanced`)
- `GET /api/progress`, `PUT /api/progress` (`item_type`, `item_id`, `status`, optional exercise `score` from 0 to 10)
- `GET /api/chats?exercise_id=...`, `POST /api/chats` (`exercise_id`, `role`, `message`, `code_snapshot`)

Registration and login set a signed, seven-day, HTTP-only, SameSite=Lax cookie. The API never returns `password_hash`. Course and exercise browsing is public. Progress and chat writes require the cookie and scope data to its user ID. `GET /api/chats` returns an empty message list for anonymous visitors; it never exposes another user's history. Personalized lesson requests use the cookie when present; anonymous learners get a beginner profile with no mastered topics.

## Schema and limits

```mermaid
erDiagram
  USERS ||--o{ USER_PROGRESS : owns
  USERS ||--o{ AI_CHATS : owns
  COURSES ||--o{ LESSONS : contains
  LESSONS ||--o{ EXERCISES : contains
  EXERCISES o|--o{ AI_CHATS : context
  USERS { uuid id PK; varchar level }
  COURSES { bigint id PK }
  LESSONS { bigint id PK; bigint course_id FK; text content_markdown }
  EXERCISES { bigint id PK; bigint lesson_id FK; jsonb test_cases; jsonb hints; jsonb tags }
  USER_PROGRESS { uuid id PK; uuid user_id FK; varchar item_type; bigint item_id; numeric score }
  AI_CHATS { uuid id PK; uuid user_id FK; bigint exercise_id FK; text message }
```

`USER_PROGRESS.item_id` is a polymorphic numeric reference and is validated against the lesson or exercise table in the service. Exercise progress stores only the latest browser-reported score per exercise, not an attempt history; the learner profile averages up to five most recent scored exercises. Quiz average is 0 until scores are recorded. Consecutive errors are kept in browser session storage and sent with the personalization request. UUID user/chat/progress identifiers remain UUIDs. Chat rows have no conversation ID or lesson ID; null exercise chat history therefore aggregates lesson chats. The six-table schema has no storage for drafts, bookmarks, attempt history, or unlocked hints. JSONB exercise test cases are readable by browsers and are not authoritative grading secrets.

When a lesson opens, the frontend asks FastAPI to personalize its stored metadata sections. FastAPI queries the user's level, completed topics, and recent exercise scores, then asks the OpenAI Responses API to rewrite explanations and illustrative examples while preserving section IDs, titles, ordering, and challenges. The OpenAI key stays on the backend. If no key is configured or the model request fails, the original database lesson remains visible.

The source has two curricula with overlapping numeric lesson IDs and different titles. Both are imported with generated numeric course, lesson, and exercise IDs; seed upserts match lessons by course and order, and exercises by title and function name. `content_markdown` contains readable Markdown plus a versioned JSON comment with the original lesson presentation metadata, allowing the API client to render the existing lesson layout without adding tables. The client resolves lesson navigation links to numeric database IDs. Re-export the curriculum and run the idempotent seed after changing static source content. Exercise-to-lesson assignments remain as originally seeded: `reverse-a-string` and `count-vowels` attach to detailed lesson `3`, while `sum-of-even-numbers` and `find-maximum` attach to lesson `7`. The source exercises do not declare canonical lesson mappings, so these assignments remain provisional and were not changed here.

## Tests

Run `pytest` for API validation, authentication primitive, and schema-shape checks. Run migrations against an isolated local PostgreSQL database for database integration tests; do not point tests at production.
