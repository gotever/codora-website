import json
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from psycopg import errors

from .auth import current_user_id, hash_password, make_token, optional_current_user_id, verify_password
from .db import connection, pool
from .interaction_trace import write_interaction_trace
from .learning_profile import get_all_concept_progress, get_completed_lessons, promote_beginner_after_six_lessons_and_four_mastered_concepts
from .personalization import personalize_lesson as create_personalized_lesson
from .runner import run_code_sandbox
from .schemas import ChatInput, ExerciseWorkspaceInput, LearningPreferences, LoginInput, PersonalizeLessonInput, ProgressInput, RegisterInput, SubmitInput, TutorChatInput, UserLevelInput
from .settings import settings
from .tutor import create_tutor_reply
from .assessments import router as assessment_router

@asynccontextmanager
async def lifespan(_app: FastAPI):
    pool.open()
    try:
        yield
    finally:
        pool.close()


app = FastAPI(title="Codora API", version="1.0.0", lifespan=lifespan)
app.include_router(assessment_router)
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


def strip_hidden_test_cases(test_case_data):
    if isinstance(test_case_data, dict):
        return {key: value for key, value in test_case_data.items() if key != "hidden"}
    return test_case_data


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
        rows = conn.execute("SELECT id,title,course_id,content_markdown,order_index,preknowledge,new_concepts FROM lessons WHERE course_id=%s ORDER BY order_index", (course_id,)).fetchall()
    return {"lessons": rows}


@app.get("/api/lessons/{lesson_id}")
def get_lesson(lesson_id: int):
    with connection() as conn:
        row = conn.execute("SELECT id,title,course_id,content_markdown,order_index,preknowledge,new_concepts FROM lessons WHERE id=%s", (lesson_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Lesson not found")
    return {"lesson": row}


def lesson_contains_challenge(content_markdown: str, challenge_id: str) -> bool:
    marker = "<!-- codora-lesson:v1\n"
    if not content_markdown.startswith(marker):
        return False
    try:
        metadata = json.loads(content_markdown[len(marker):].split("\n-->\n", 1)[0])
    except (json.JSONDecodeError, IndexError, TypeError):
        return False
    sections = metadata.get("sections", []) if isinstance(metadata, dict) else []
    return any(
        isinstance(section, dict)
        and isinstance(section.get("challenge"), dict)
        and section["challenge"].get("id") == challenge_id
        for section in sections
    )


@app.get("/api/lessons/{lesson_id}/challenge-progress")
def get_lesson_challenge_progress(
    lesson_id: int,
    user_id: str | None = Depends(optional_current_user_id),
):
    if user_id is None:
        return {"completed_challenge_ids": []}
    with connection() as conn:
        rows = conn.execute("""SELECT challenge_id FROM lesson_challenge_progress
            WHERE user_id=%s AND lesson_id=%s ORDER BY completed_at""", (user_id, lesson_id)).fetchall()
    return {"completed_challenge_ids": [row["challenge_id"] for row in rows]}


@app.put("/api/lessons/{lesson_id}/challenges/{challenge_id}/progress")
def complete_lesson_challenge(lesson_id: int, challenge_id: str, user_id: str = Depends(current_user_id)):
    with connection() as conn:
        lesson = conn.execute("SELECT content_markdown FROM lessons WHERE id=%s", (lesson_id,)).fetchone()
        if not lesson:
            raise HTTPException(404, "Lesson not found")
        if not lesson_contains_challenge(lesson["content_markdown"], challenge_id):
            raise HTTPException(404, "Code challenge not found in this lesson")
        row = conn.execute("""INSERT INTO lesson_challenge_progress(user_id,lesson_id,challenge_id)
            VALUES(%s,%s,%s)
            ON CONFLICT(user_id,lesson_id,challenge_id) DO UPDATE SET completed_at=COALESCE(
                lesson_challenge_progress.completed_at,EXCLUDED.completed_at)
            RETURNING challenge_id,completed_at""", (user_id, lesson_id, challenge_id)).fetchone()
    return {"progress": row}


@app.post("/api/lessons/{lesson_id}/personalize")
def adapt_lesson(
    lesson_id: int,
    body: PersonalizeLessonInput,
    user_id: str | None = Depends(optional_current_user_id),
):
    with connection() as conn:
        lesson = conn.execute(
            "SELECT content_markdown,preknowledge,new_concepts FROM lessons WHERE id=%s", (lesson_id,)
        ).fetchone()
    if not lesson:
        raise HTTPException(404, "Lesson not found")
    content, ability = create_personalized_lesson(
        lesson["content_markdown"], user_id, body.consecutive_errors,
        lesson["preknowledge"], lesson["new_concepts"],
    )
    return {"content_markdown": content, "ability": ability.model_dump()}


@app.get("/api/lessons/{lesson_id}/exercises")
def lesson_exercises(lesson_id: int):
    with connection() as conn:
        rows = conn.execute("SELECT id,lesson_id,title,difficulty,description,function_name,starter_code,test_cases,hints,tags FROM exercises WHERE lesson_id=%s ORDER BY (test_cases->>'number')::int,title", (lesson_id,)).fetchall()
    for row in rows:
        row["test_cases"] = strip_hidden_test_cases(row["test_cases"])
    return {"exercises": rows}


@app.get("/api/exercises")
def list_exercises():
    with connection() as conn:
        rows = conn.execute("""SELECT e.id,e.lesson_id,e.title,e.difficulty,e.description,e.function_name,
            e.starter_code,e.test_cases,e.hints,e.tags,l.course_id,c.title AS course_title
            FROM exercises e JOIN lessons l ON l.id=e.lesson_id JOIN courses c ON c.id=l.course_id
            ORDER BY (e.test_cases->>'number')::int,e.title""").fetchall()
    for row in rows:
        row["test_cases"] = strip_hidden_test_cases(row["test_cases"])
    return {"exercises": rows}


def find_exercise_detail(conn, exercise_id: str):
    if exercise_id.isdigit():
        return conn.execute(
            """SELECT e.id,e.lesson_id,e.title,e.difficulty,e.description,e.function_name,
                e.starter_code,e.test_cases,e.hints,e.tags,l.course_id,c.title AS course_title
                FROM exercises e
                JOIN lessons l ON l.id=e.lesson_id
                JOIN courses c ON c.id=l.course_id
                WHERE e.id = %s
                   OR e.test_cases->>'slug' = %s
                   OR e.function_name = %s
                   OR replace(e.function_name, '_', '-') = %s
                LIMIT 1""",
            (int(exercise_id), exercise_id, exercise_id, exercise_id),
        ).fetchone()
    return conn.execute(
        """SELECT e.id,e.lesson_id,e.title,e.difficulty,e.description,e.function_name,
            e.starter_code,e.test_cases,e.hints,e.tags,l.course_id,c.title AS course_title
            FROM exercises e
            JOIN lessons l ON l.id=e.lesson_id
            JOIN courses c ON c.id=l.course_id
            WHERE e.test_cases->>'slug' = %s
               OR e.function_name = %s
               OR replace(e.function_name, '_', '-') = %s
            LIMIT 1""",
        (exercise_id, exercise_id, exercise_id),
    ).fetchone()


def find_exercise_for_submit(conn, exercise_id: str):
    if exercise_id.isdigit():
        return conn.execute(
            """SELECT id, function_name, test_cases FROM exercises
            WHERE id = %s
               OR test_cases->>'slug' = %s
               OR function_name = %s
               OR replace(function_name, '_', '-') = %s
            LIMIT 1""",
            (int(exercise_id), exercise_id, exercise_id, exercise_id),
        ).fetchone()
    return conn.execute(
        """SELECT id, function_name, test_cases FROM exercises
        WHERE test_cases->>'slug' = %s
           OR function_name = %s
           OR replace(function_name, '_', '-') = %s
        LIMIT 1""",
        (exercise_id, exercise_id, exercise_id),
    ).fetchone()


@app.get("/api/exercises/{exercise_id}")
def get_exercise(exercise_id: str):
    with connection() as conn:
        row = find_exercise_detail(conn, exercise_id)
    if not row:
        raise HTTPException(404, "Exercise not found")
    row["test_cases"] = strip_hidden_test_cases(row["test_cases"])
    return {"exercise": row}


@app.post("/api/exercises/{exercise_id}/submit")
def submit_exercise(
    exercise_id: str,
    body: SubmitInput,
    user_id: str | None = Depends(optional_current_user_id),
):
    with connection() as conn:
        row = find_exercise_for_submit(conn, exercise_id)
    if not row:
        raise HTTPException(404, "Exercise not found")

    test_case_data = row["test_cases"] or {}
    if isinstance(test_case_data, dict):
        visible_cases = test_case_data.get("runner") or []
        hidden_cases = test_case_data.get("hidden") or []
        all_cases = [
            *({**case, "is_hidden": False} for case in visible_cases),
            *({**case, "is_hidden": True} for case in hidden_cases),
        ]
    elif isinstance(test_case_data, list):
        all_cases = test_case_data
    else:
        all_cases = []
    if not all_cases:
        raise HTTPException(400, "No test cases configured for this exercise")

    trace_context = {"exercise_id": exercise_id, "function_name": row["function_name"]}
    trace_input = {"code": body.code, "test_case_count": len(all_cases)}
    try:
        result = run_code_sandbox(body.code, row["function_name"], all_cases, timeout_seconds=3.0)
    except Exception as exc:
        write_interaction_trace(
            event="exercise_submission",
            user_id=user_id,
            context=trace_context,
            input_data=trace_input,
            error=f"{type(exc).__name__}: {str(exc)[:300]}",
        )
        raise
    write_interaction_trace(
        event="exercise_submission",
        user_id=user_id,
        context=trace_context,
        input_data=trace_input,
        output_data=result,
    )
    if user_id:
        score = result["passed_count"] / result["total_count"] * 10 if result["total_count"] else 0
        status = "completed" if result["status"] == "Accepted" else "in_progress"
        with connection() as conn:
            conn.execute(
                """INSERT INTO user_progress(user_id,item_type,item_id,status,completed_at,score,last_attempt_at)
                    VALUES(%s,'exercise',%s,%s,CASE WHEN %s='completed' THEN now() ELSE NULL END,%s,now())
                    ON CONFLICT(user_id,item_type,item_id) DO UPDATE SET
                    status=CASE WHEN user_progress.status='completed' THEN 'completed' ELSE EXCLUDED.status END,
                    completed_at=CASE WHEN user_progress.status='completed' OR EXCLUDED.status='completed'
                        THEN COALESCE(user_progress.completed_at,now()) ELSE NULL END,
                    score=EXCLUDED.score,last_attempt_at=now()""",
                (user_id, row["id"], status, status, score),
            )
            failed_case = result.get("failed_case") or {}
            submission = {
                "status": result.get("status"),
                "passed_count": result.get("passed_count"),
                "total_count": result.get("total_count"),
                "runtime_ms": result.get("runtime_ms"),
                "failed_case": {
                    key: failed_case[key] for key in ("label", "case_id", "is_hidden", "actual", "expected", "error")
                    if key in failed_case
                },
                "error": result.get("error"),
            }
            conn.execute("""INSERT INTO ai_chats(user_id,exercise_id,context_key,event_type,role,message,code_snapshot)
                VALUES(%s,%s,%s,'submission','user',%s,%s)""",
                (user_id, exercise_id, f"exercise:{exercise_id}", json.dumps(submission, ensure_ascii=False), body.code))
            if result["status"] == "Accepted":
                promote_beginner_after_six_lessons_and_four_mastered_concepts(conn, user_id)
    return result


@app.get("/api/exercises/{exercise_id}/submissions")
def get_exercise_submissions(exercise_id: int, user_id: str = Depends(current_user_id)):
    with connection() as conn:
        if not conn.execute("SELECT 1 FROM exercises WHERE id=%s", (exercise_id,)).fetchone():
            raise HTTPException(404, "Exercise not found")
        rows = conn.execute("""SELECT id,message,code_snapshot,created_at FROM ai_chats
            WHERE user_id=%s AND exercise_id=%s AND event_type='submission'
            ORDER BY created_at DESC,id DESC""", (user_id, exercise_id)).fetchall()

    submissions = []
    for row in rows:
        try:
            result = json.loads(row["message"])
        except (TypeError, json.JSONDecodeError):
            continue
        if not isinstance(result, dict):
            continue
        submissions.append({
            "id": str(row["id"]),
            "status": result.get("status"),
            "passed_count": result.get("passed_count", 0),
            "total_count": result.get("total_count", 0),
            "runtime_ms": result.get("runtime_ms", 0),
            "code": row["code_snapshot"] or "",
            "created_at": row["created_at"].isoformat(),
        })
    return {"submissions": submissions}


@app.get("/api/exercises/{exercise_id}/workspace")
def get_exercise_workspace(exercise_id: int, user_id: str = Depends(current_user_id)):
    with connection() as conn:
        if not conn.execute("SELECT 1 FROM exercises WHERE id=%s", (exercise_id,)).fetchone():
            raise HTTPException(404, "Exercise not found")
        row = conn.execute("""SELECT draft_code,latest_run_code,latest_run_result,updated_at
            FROM exercise_workspace_state WHERE user_id=%s AND exercise_id=%s""", (user_id, exercise_id)).fetchone()
    if not row:
        return {"draft_code": None, "latest_run_code": None, "latest_run_result": None, "updated_at": None}
    return {**row, "updated_at": row["updated_at"].isoformat()}


@app.put("/api/exercises/{exercise_id}/workspace")
def save_exercise_workspace(
    exercise_id: int,
    body: ExerciseWorkspaceInput,
    user_id: str = Depends(current_user_id),
):
    with connection() as conn:
        if not conn.execute("SELECT 1 FROM exercises WHERE id=%s", (exercise_id,)).fetchone():
            raise HTTPException(404, "Exercise not found")
        conn.execute("""INSERT INTO exercise_workspace_state
                (user_id,exercise_id,draft_code,latest_run_code,latest_run_result,updated_at)
            VALUES(%s,%s,%s,%s,%s::jsonb,now())
            ON CONFLICT(user_id,exercise_id) DO UPDATE SET
                draft_code=EXCLUDED.draft_code,
                latest_run_code=COALESCE(EXCLUDED.latest_run_code,exercise_workspace_state.latest_run_code),
                latest_run_result=COALESCE(EXCLUDED.latest_run_result,exercise_workspace_state.latest_run_result),
                updated_at=now()""",
            (user_id, exercise_id, body.draft_code, body.latest_run_code,
             json.dumps(body.latest_run_result, ensure_ascii=False) if body.latest_run_result is not None else None),
        )
    return {"saved": True}


@app.post("/api/auth/register", status_code=201)
def register(body: RegisterInput, response: Response):
    try:
        with connection() as conn:
            user = conn.execute("""INSERT INTO users(email,username,password_hash,full_name,level) VALUES(%s,%s,%s,%s,%s)
                RETURNING id,email,username,full_name,level,created_at,learning_preferences""", (str(body.email).lower(), body.username, hash_password(body.password), body.full_name, body.level)).fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "Email or username is already registered") from None
    set_session(response, str(user["id"]), user["email"])
    user["id"] = str(user["id"])
    user["created_at"] = user["created_at"].isoformat()
    return {"user": user}


@app.post("/api/auth/login")
def login(body: LoginInput, response: Response):
    with connection() as conn:
        user = conn.execute("SELECT id,email,username,full_name,level,created_at,learning_preferences,password_hash FROM users WHERE email=%s", (str(body.email).lower(),)).fetchone()
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
        user = conn.execute("SELECT id,email,username,full_name,level,created_at,learning_preferences FROM users WHERE id=%s", (user_id,)).fetchone()
    if not user:
        raise HTTPException(401, "Authentication required")
    user["id"] = str(user["id"])
    user["created_at"] = user["created_at"].isoformat()
    return {"user": user}


@app.put("/api/auth/level")
def update_level(body: UserLevelInput, user_id: str = Depends(current_user_id)):
    with connection() as conn:
        current = conn.execute('SELECT level FROM users WHERE id=%s', (user_id,)).fetchone()
        if current and current['level'] == 'beginner' and body.level != 'beginner':
            promoted = promote_beginner_after_six_lessons_and_four_mastered_concepts(conn, user_id)
            if not promoted or body.level != 'intermediate':
                raise HTTPException(403, 'Pass the promotion assessment and master four concepts first')
        user = conn.execute(
            "UPDATE users SET level=%s WHERE id=%s RETURNING level", (body.level, user_id)
        ).fetchone()
    if not user:
        raise HTTPException(401, "Authentication required")
    return {"level": user["level"]}


@app.put("/api/auth/learning-preferences")
def update_learning_preferences(body: LearningPreferences, user_id: str = Depends(current_user_id)):
    preferences = body.model_dump()
    with connection() as conn:
        user = conn.execute(
            "UPDATE users SET learning_preferences=%s::jsonb WHERE id=%s RETURNING learning_preferences",
            (json.dumps(preferences), user_id),
        ).fetchone()
    if not user:
        raise HTTPException(401, "Authentication required")
    return {"learning_preferences": user["learning_preferences"]}


@app.get("/api/progress")
def get_progress(user_id: str = Depends(current_user_id)):
    with connection() as conn:
        rows = conn.execute("SELECT id,item_type,item_id,status,completed_at FROM user_progress WHERE user_id=%s ORDER BY id", (user_id,)).fetchall()
        completed_lessons = get_completed_lessons(conn, user_id)
        concepts = get_all_concept_progress(conn, user_id)
        completed_lesson_challenges = conn.execute("""SELECT COUNT(*) AS count
            FROM lesson_challenge_progress AS challenge
            JOIN lessons AS lesson ON lesson.id=challenge.lesson_id
            JOIN courses AS course ON course.id=lesson.course_id
            WHERE challenge.user_id=%s AND course.title='Python fundamentals'""", (user_id,)).fetchone()["count"]
    return {"progress": rows, "completed_lessons": completed_lessons, "concepts": concepts,
        "completed_lesson_challenges": completed_lesson_challenges}


@app.put("/api/progress")
def put_progress(body: ProgressInput, user_id: str = Depends(current_user_id)):
    if body.score is not None and body.item_type != "exercise":
        raise HTTPException(422, "Scores can only be recorded for exercises")
    table = "lessons" if body.item_type == "lesson" else "exercises"
    with connection() as conn:
        if not conn.execute(f"SELECT 1 FROM {table} WHERE id=%s", (body.item_id,)).fetchone():
            raise HTTPException(404, "Progress item not found")
        row = conn.execute("""INSERT INTO user_progress(user_id,item_type,item_id,status,completed_at,score,last_attempt_at)
            VALUES(%s,%s,%s,%s,CASE WHEN %s='completed' THEN now() ELSE NULL END,%s,
                CASE WHEN %s::numeric IS NOT NULL THEN now() ELSE NULL END)
            ON CONFLICT(user_id,item_type,item_id) DO UPDATE SET status=EXCLUDED.status,
            completed_at=CASE WHEN EXCLUDED.status='completed' THEN COALESCE(user_progress.completed_at,now()) ELSE NULL END,
            score=COALESCE(EXCLUDED.score,user_progress.score),
            last_attempt_at=COALESCE(EXCLUDED.last_attempt_at,user_progress.last_attempt_at)
            RETURNING id,item_type,item_id,status,completed_at,score,last_attempt_at""",
            (user_id,body.item_type,body.item_id,body.status,body.status,body.score,body.score)).fetchone()
        upgraded_level = None
        if body.status == "completed":
            upgraded_level = promote_beginner_after_six_lessons_and_four_mastered_concepts(conn, user_id)
    row["id"] = str(row["id"])
    response = {"progress": row}
    if upgraded_level:
        response["level"] = upgraded_level
    return response


@app.get("/api/chats")
def get_chats(exercise_id: int | None = None, context_key: str | None = None, user_id: str | None = Depends(optional_current_user_id)):
    if user_id is None:
        return {"messages": []}
    with connection() as conn:
        if context_key is not None:
            rows = conn.execute("""SELECT id,exercise_id,context_key,event_type,role,message,code_snapshot,created_at
                FROM ai_chats WHERE user_id=%s AND context_key=%s AND event_type='chat'
                ORDER BY created_at,CASE role WHEN 'user' THEN 0 ELSE 1 END,id""", (user_id, context_key)).fetchall()
        elif exercise_id is not None:
            rows = conn.execute("""SELECT id,exercise_id,role,message,code_snapshot,created_at
                FROM ai_chats WHERE user_id=%s AND exercise_id=%s
                ORDER BY created_at,CASE role WHEN 'user' THEN 0 ELSE 1 END,id""", (user_id, exercise_id)).fetchall()
        else:
            rows = conn.execute("""SELECT id,exercise_id,role,message,code_snapshot,created_at
                FROM ai_chats WHERE user_id=%s AND exercise_id IS NULL
                ORDER BY created_at,CASE role WHEN 'user' THEN 0 ELSE 1 END,id""", (user_id,)).fetchall()
    for row in rows:
        row["id"] = str(row["id"])
    return {"messages": rows}


@app.post("/api/tutor/chat")
def tutor_chat(body: TutorChatInput, user_id: str = Depends(current_user_id)):
    return create_tutor_reply(user_id, body)


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
