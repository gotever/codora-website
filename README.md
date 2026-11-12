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

Schema status: `python -m app.migrate --status` (run from `backend/`). API health: `http://localhost:3001/api/health`.

Frontend build: `cd frontend; npm run build`. Backend tests: from `backend/`, run `pytest`.

## Architecture and data

- `frontend/`: current anonymous learning UI, routes, editor, Pyodide runner, and API client.
- `backend/app/`: FastAPI routes, validation, Argon2id/JWT auth, PostgreSQL connection pool, migration and seed commands.
- `backend/migrations/001_initial_schema.sql`: the six application tables, constraints, and indexes.
- `backend/data/curriculum.json`: complete export of the existing local course, lesson, exercise, example, challenge, hint, and test-case content.

The source contains two overlapping but inconsistent curricula: `python-fundamentals` has eight learning-card lessons, while `python-foundations` has twelve detailed lesson routes with different titles for IDs 1–8. Since `LESSONS.id` is a primary key, both sets cannot use their existing colliding IDs at once. The seed keeps both course records and the twelve detailed route records under `python-foundations`; the eight-card lesson list remains available in the frontend fallback. Exercises require a lesson FK and are linked by topic to lessons 3 (strings) or 7 (lists/loops), while preserving their original source course metadata in JSONB. This inferred link is documented as unresolved curriculum ownership and should be reconciled before changing route IDs or moving content.

Lesson modules remain a frontend presentation concept because the six-table design has no module table. `USER_PROGRESS.item_id` stays polymorphic and the API verifies the target record before each write. A completion sent after local Pyodide tests is learner-reported progress; the server does not execute or grade code.

`AI_CHATS` deliberately has no conversation or lesson identifier. Exercise messages are scoped by exercise; lesson messages use a null `exercise_id`, so lesson chats cannot be separated or retrieved per lesson. The current mock assistant response is retained and persisted only when authenticated.

The browser can inspect JSONB test cases returned by the exercise API. This is not a hidden grading interface. The schema also cannot store drafts, bookmarks, submissions, or unlocked hint state, so those existing local behaviors are not represented as persistent database features.
