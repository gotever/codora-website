# Codora

Codora is a React + TypeScript + Vite learning app with browser-based Python execution through Pyodide. The optional backend uses FastAPI, PostgreSQL 16, psycopg 3, Argon2id password hashing, and signed HTTP-only session cookies. The browser only calls the HTTP API; it never connects to PostgreSQL.

## Local development

Requirements: Node.js 20+, Python 3.10+, and Docker.

### 1. Environment configuration

All configuration is consolidated into a **single `.env` file** at the repository root:

```bash
cp .env.example .env
```
*(Update passwords, JWT secrets, or API keys in `.env` if needed)*

---

### 2. Start Backend & Database

You can run the backend in one of two ways:

#### Option A: Docker Compose (Recommended)
Starts PostgreSQL, builds the FastAPI backend, runs migrations, seeds curriculum data, and launches the API at `http://localhost:3001`:

```bash
docker compose up -d --build
```

#### Option B: Local Development Script
If running PostgreSQL via Docker (`docker compose up -d postgres`) and Python natively:

```bash
./backend/dev.sh
```
*The script automatically sets up the `.venv`, installs requirements, applies migrations, seeds data, and starts Uvicorn with hot-reload.*

---

### 3. Start Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Visit the app at **`http://localhost:5173`**. Vite automatically proxies `/api` requests to `http://localhost:3001`.

---

Authentication pages are available at `/login` and `/register`. Registration requires a valid email, a 3–64 character username (`a-z`, `A-Z`, `0-9`, `_`, `.`, `-`), a 12–128 character password, and a 1–160 character full name. Registration creates a signed seven-day HTTP-only session cookie; the frontend sends credentialed requests and restores the session from `GET /api/auth/me`. Logout calls `POST /api/auth/logout`. Configure `FRONTEND_ORIGIN` in `backend/.env` to the exact frontend origin; `COOKIE_SECURE=false` is for local HTTP only. Set `VITE_API_URL` when the API is not reachable through the Vite `/api` proxy.

The lesson and exercise tutors use the backend `OPENAI_API_KEY`; run migration `006_ai_tutor_memory.sql` before starting the updated API. Each tutor context keeps eight recent messages/events, summarizes older messages into at most 500 characters, and stores structured learning memory per user and context. Exercise tutor requests include the current code and the latest run/submission state. See [docs/ai-tutor-memory.md](docs/ai-tutor-memory.md) for the request flow and memory details.

Schema status: `python -m app.migrate --status` (run from `backend/`). API health: `http://localhost:3001/api/health`.

Frontend build: `cd frontend; npm run build`. Backend tests: from `backend/`, run `pytest`.

## Architecture and data

- `frontend/`: current anonymous learning UI, routes, editor, Pyodide runner, and API client.
- `backend/app/`: FastAPI routes, validation, Argon2id/JWT auth, PostgreSQL connection pool, migration and seed commands.
- `backend/migrations/001_initial_schema.sql`: the six application tables, constraints, and indexes.
- `backend/data/curriculum.json`: complete export of the existing local course, lesson, exercise, example, challenge, hint, and test-case content.

The curriculum has one canonical course, `python-fundamentals`, with twelve detailed lessons. The eight preview lessons and detailed lesson routes share the same course and order; the detailed lesson content is seeded for those positions. During seeding, progress and exercise references from the retired `Python foundations` course are remapped by lesson order before that duplicate course is removed. Exercises remain provisionally linked by topic to lessons 3 (strings) or 7 (lists/loops), while preserving their original source course metadata in JSONB.

Lesson modules remain a frontend presentation concept because the six-table design has no module table. `USER_PROGRESS.item_id` stays polymorphic and the API verifies the target record before each write. A completion sent after local Pyodide tests is learner-reported progress; the server does not execute or grade code.

`AI_CHATS` stores tutor chat and authenticated exercise submission events, scoped with `context_key` by lesson or exercise. Lesson and exercise conversations can be retrieved independently. Tutor access and persistent chat memory require authentication.

The browser can inspect JSONB test cases returned by the exercise API. This is not a hidden grading interface. The schema also cannot store drafts, bookmarks, submissions, or unlocked hint state, so those existing local behaviors are not represented as persistent database features.
