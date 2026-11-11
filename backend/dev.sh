#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "==> 🚀 Codora Backend Dev Runner"

# 1. Check or Create Virtualenv
if [ ! -d ".venv" ]; then
  echo "==> Creating virtual environment (.venv)..."
  python3 -m venv .venv
fi

# 2. Activate Virtualenv
source .venv/bin/activate

# 3. Check or Install dependencies
if ! python -c "import fastapi, psycopg, uvicorn" 2>/dev/null; then
  echo "==> Installing Python dependencies..."
  pip install -r requirements.txt
fi

# 4. Check Database Connection
echo "==> Verifying database connection..."
if ! python -c "from app.db import connection; conn = connection(); conn.execute('SELECT 1'); conn.close()" 2>/dev/null; then
  echo ""
  echo "⚠️  Cannot connect to PostgreSQL database!"
  echo "👉 Please start the database first by running:"
  echo "   docker compose up -d postgres"
  echo ""
  exit 1
fi

# 5. Run Migrations & Seed
echo "==> Running database migrations..."
python -m app.migrate

echo "==> Seeding database content..."
python -m app.seed

# 6. Start FastAPI with Hot-Reload
echo "==> Starting Codora API server on http://localhost:3001 ..."
exec uvicorn app.main:app --reload --host 0.0.0.0 --port 3001

\n