from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg import errors

from .auth import current_user_id, hash_password, make_token, verify_password
from .db import connection, pool
from .schemas import ChatInput, LoginInput, ProgressInput, RegisterInput
from .settings import settings

@asynccontextmanager
async def lifespan(_app: FastAPI):
    pool.open()
    try:
        yield
    finally:
        pool.close()


app = FastAPI(title="Codora API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def safe_validation_error(_request, _error):
    # FastAPI's default validation response echoes rejected values, which may include passwords.
    return JSONResponse(status_code=422, content={"detail": "Invalid request input"})


def set_session(response: Response, user_id: str, email: str) -> None:
    response.set_cookie("codora_session", make_token(user_id, email), httponly=True,
                        secure=settings.cookie_secure, samesite="lax", max_age=604800, path="/")


@app.get("/api/health")
def health():
    try:
        with connection() as conn:
            conn.execute("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception:
        raise HTTPException(status_code=503, detail={"status": "error", "database": "unavailable"}) from None


@app.get("/api/courses")
def list_courses():
    with connection() as conn:
        rows = conn.execute("""SELECT c.id, c.title, c.description, c.order_index,
            count(l.id)::int AS lesson_count FROM courses c LEFT JOIN lessons l ON l.course_id=c.id
            GROUP BY c.id ORDER BY c.order_index""").fetchall()
    return {"courses": rows}


@app.get("/api/courses/{course_id}")
def get_course(course_id: int):
    with connection() as conn:
        row = conn.execute("SELECT id,title,description,order_index FROM courses WHERE id=%s", (course_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Course not found")
    return {"course": row}


@app.get("/api/courses/{course_id}/lessons")
def course_lessons(course_id: int):
    with connection() as conn:
        rows = conn.execute("SELECT id,title,course_id,content_markdown,order_index FROM lessons WHERE course_id=%s ORDER BY order_index", (course_id,)).fetchall()
    return {"lessons": rows}


@app.get("/api/lessons/{lesson_id}")
def get_lesson(lesson_id: str):
    with connection() as conn:
        row = conn.execute("SELECT id,title,course_id,content_markdown,order_index FROM lessons WHERE id=%s", (lesson_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Lesson not found")
    return {"lesson": row}


@app.get("/api/lessons/{lesson_id}/exercises")
def lesson_exercises(lesson_id: str):
    with connection() as conn:
        rows = conn.execute("SELECT id,lesson_id,title,difficulty,description,function_name,starter_code,test_cases,hints,tags FROM exercises WHERE lesson_id=%s ORDER BY title", (lesson_id,)).fetchall()
    return {"exercises": rows}


@app.get("/api/exercises")
def list_exercises():
    with connection() as conn:
        rows = conn.execute("""SELECT e.id,e.lesson_id,e.title,e.difficulty,e.description,e.function_name,
            e.starter_code,e.test_cases,e.hints,e.tags,l.course_id,c.title AS course_title
            FROM exercises e JOIN lessons l ON l.id=e.lesson_id JOIN courses c ON c.id=l.course_id
            ORDER BY e.title""").fetchall()
    return {"exercises": rows}


@app.get("/api/exercises/{exercise_id}")
def get_exercise(exercise_id: str):
    with connection() as conn:
        row = conn.execute("""SELECT e.id,e.lesson_id,e.title,e.difficulty,e.description,e.function_name,
            e.starter_code,e.test_cases,e.hints,e.tags,l.course_id,c.title AS course_title
            FROM exercises e JOIN lessons l ON l.id=e.lesson_id JOIN courses c ON c.id=l.course_id WHERE e.id=%s""", (exercise_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Exercise not found")
    return {"exercise": row}


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterInput, response: Response):
    try:
        with connection() as conn:
            user = conn.execute("""INSERT INTO users(email,username,password_hash,full_name) VALUES(%s,%s,%s,%s)
                RETURNING id,email,username,full_name,created_at""", (str(body.email).lower(), body.username, hash_password(body.password), body.full_name)).fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "Email or username is already registered") from None
    set_session(response, str(user["id"]), user["email"])
    user["id"] = str(user["id"])
    user["created_at"] = user["created_at"].isoformat()
    return {"user": user}


@app.post("/api/auth/login")
def login(body: LoginInput, response: Response):
    with connection() as conn:
        user = conn.execute("SELECT id,email,username,full_name,created_at,password_hash FROM users WHERE email=%s", (str(body.email).lower(),)).fetchone()
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    set_session(response, str(user["id"]), user["email"])
    user.pop("password_hash")
    user["id"] = str(user["id"])
    user["created_at"] = user["created_at"].isoformat()
    return {"user": user}


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie("codora_session", path="/", httponly=True, secure=settings.cookie_secure, samesite="lax")
    return {"success": True}


@app.get("/api/auth/me")
def me(user_id: str = Depends(current_user_id)):
    with connection() as conn:
        user = conn.execute("SELECT id,email,username,full_name,created_at FROM users WHERE id=%s", (user_id,)).fetchone()
    if not user:
        raise HTTPException(401, "Authentication required")
    user["id"] = str(user["id"])
    user["created_at"] = user["created_at"].isoformat()
    return {"user": user}


@app.get("/api/progress")
def get_progress(user_id: str = Depends(current_user_id)):
    with connection() as conn:
        rows = conn.execute("SELECT id,item_type,item_id,status,completed_at FROM user_progress WHERE user_id=%s ORDER BY id", (user_id,)).fetchall()
    return {"progress": rows}


@app.put("/api/progress")
def put_progress(body: ProgressInput, user_id: str = Depends(current_user_id)):
    table = "lessons" if body.item_type == "lesson" else "exercises"
    with connection() as conn:
        if not conn.execute(f"SELECT 1 FROM {table} WHERE id=%s", (body.item_id,)).fetchone():
            raise HTTPException(404, "Progress item not found")
        row = conn.execute("""INSERT INTO user_progress(user_id,item_type,item_id,status,completed_at)
            VALUES(%s,%s,%s,%s,CASE WHEN %s='completed' THEN now() ELSE NULL END)
            ON CONFLICT(user_id,item_type,item_id) DO UPDATE SET status=EXCLUDED.status,
            completed_at=CASE WHEN EXCLUDED.status='completed' THEN COALESCE(user_progress.completed_at,now()) ELSE NULL END
            RETURNING id,item_type,item_id,status,completed_at""", (user_id,body.item_type,body.item_id,body.status,body.status)).fetchone()
    row["id"] = str(row["id"])
    return {"progress": row}


@app.get("/api/chats")
def get_chats(exercise_id: str | None = None, user_id: str = Depends(current_user_id)):
    with connection() as conn:
        if exercise_id:
            rows = conn.execute("SELECT id,exercise_id,role,message,code_snapshot,created_at FROM ai_chats WHERE user_id=%s AND exercise_id=%s ORDER BY created_at", (user_id, exercise_id)).fetchall()
        else:
            rows = conn.execute("SELECT id,exercise_id,role,message,code_snapshot,created_at FROM ai_chats WHERE user_id=%s AND exercise_id IS NULL ORDER BY created_at", (user_id,)).fetchall()
    for row in rows:
        row["id"] = str(row["id"])
    return {"messages": rows}


@app.post("/api/chats", status_code=201)
def post_chat(body: ChatInput, user_id: str = Depends(current_user_id)):
    with connection() as conn:
        if body.exercise_id and not conn.execute("SELECT 1 FROM exercises WHERE id=%s", (body.exercise_id,)).fetchone():
            raise HTTPException(404, "Exercise not found")
        row = conn.execute("""INSERT INTO ai_chats(user_id,exercise_id,role,message,code_snapshot)
            VALUES(%s,%s,%s,%s,%s) RETURNING id,exercise_id,role,message,code_snapshot,created_at""",
            (user_id,body.exercise_id,body.role,body.message.strip(),body.code_snapshot)).fetchone()
    row["id"] = str(row["id"])
    return {"message": row}
