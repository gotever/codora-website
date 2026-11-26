@echo off
setlocal

set "ROOT=%~dp0"

if not exist "%ROOT%backend\.venv\Scripts\python.exe" (
    echo Backend virtual environment not found: backend\.venv
    echo Create it and install backend\requirements.txt first.
    pause
    exit /b 1
)

"%ROOT%backend\.venv\Scripts\python.exe" -c "import fastapi, uvicorn, psycopg, pydantic_settings, argon2, jwt, email_validator, openai" >nul 2>&1
if errorlevel 1 (
    echo Installing missing backend dependencies...
    "%ROOT%backend\.venv\Scripts\python.exe" -m pip install -r "%ROOT%backend\requirements.txt"
    if errorlevel 1 (
        echo Backend dependency installation failed.
        pause
        exit /b 1
    )
)

if not exist "%ROOT%frontend\node_modules\.bin\vite.cmd" (
    echo Frontend dependencies not found: frontend\node_modules
    echo Run npm install in the frontend folder first.
    pause
    exit /b 1
)

echo Starting Codora backend and frontend in separate windows...
echo PostgreSQL must be running before the backend starts.

start "Codora Backend" /D "%ROOT%backend" cmd /k "set "ASSESSMENT_RUNNER_LOCAL_FALLBACK=true" && call .venv\Scripts\activate.bat && python -m app.migrate && python -m app.seed && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 3001"
start "Codora Frontend" /D "%ROOT%frontend" cmd /k "npm run dev"

echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3001

endlocal
