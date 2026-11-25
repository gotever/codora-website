from typing import Any


def promote_beginner_after_six_lessons_and_four_mastered_concepts(conn: Any, user_id: str) -> str | None:
    # A simultaneous progress completion and assessment submission must not miss promotion.
    conn.execute('SELECT pg_advisory_xact_lock(hashtextextended(%s,731906))', (user_id,))
    completed = conn.execute(
        """SELECT COUNT(DISTINCT lesson.id)::int AS completed_count
            FROM lessons AS lesson
            JOIN courses AS course ON course.id=lesson.course_id
            JOIN user_progress AS progress
              ON progress.item_id=lesson.id
             AND progress.user_id=%s
             AND progress.item_type='lesson'
             AND progress.status='completed'
            WHERE lesson.id IN (SELECT l.id FROM lessons l JOIN courses c ON c.id=l.course_id
                WHERE c.title='Python fundamentals' ORDER BY l.order_index,l.id LIMIT 6)""",
        (user_id,),
    ).fetchone()["completed_count"]
    if completed < 6:
        return None

    if not conn.execute("SELECT 1 FROM assessments WHERE user_id=%s AND status='passed' LIMIT 1", (user_id,)).fetchone():
        return None

    mastered = conn.execute(
        """SELECT COUNT(*)::int AS mastered_count
            FROM (
                SELECT mapping.concept_id
                FROM exercise_concepts AS mapping
                JOIN user_progress AS progress
                  ON progress.item_id=mapping.exercise_id
                 AND progress.user_id=%s
                 AND progress.item_type='exercise'
                 AND progress.status='completed'
                 AND progress.score>=8
                GROUP BY mapping.concept_id
                HAVING COUNT(DISTINCT mapping.exercise_id)>=2
            ) AS mastered_concepts""",
        (user_id,),
    ).fetchone()["mastered_count"]
    if mastered < 4:
        return None

    updated = conn.execute(
        "UPDATE users SET level='intermediate' WHERE id=%s AND level='beginner' RETURNING level",
        (user_id,),
    ).fetchone()
    if updated:
        return updated["level"]

    current = conn.execute("SELECT level FROM users WHERE id=%s", (user_id,)).fetchone()
    return current["level"] if current else None


def get_concept_details(conn: Any, concept_ids: list[str]) -> list[dict[str, str]]:
    ordered_ids = list(dict.fromkeys(concept_ids))
    if not ordered_ids:
        return []

    rows = conn.execute(
        "SELECT id,name,description FROM learning_concepts WHERE id=ANY(%s)",
        (ordered_ids,),
    ).fetchall()
    by_id = {row["id"]: row for row in rows}
    return [
        {"id": concept_id, "name": by_id[concept_id]["name"], "description": by_id[concept_id]["description"]}
        for concept_id in ordered_ids
        if concept_id in by_id
    ]


def get_completed_lesson_concept_ids(conn: Any, user_id: str | None) -> set[str]:
    if user_id is None:
        return set()
    rows = conn.execute(
        """SELECT DISTINCT concept.value AS concept_id
            FROM user_progress AS progress
            JOIN lessons AS lesson ON lesson.id=progress.item_id
            CROSS JOIN LATERAL jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(lesson.new_concepts)='array'
                THEN lesson.new_concepts ELSE '[]'::jsonb END
            ) AS concept(value)
            WHERE progress.user_id=%s AND progress.item_type='lesson' AND progress.status='completed'""",
        (user_id,),
    ).fetchall()
    return {row["concept_id"] for row in rows}


def get_concept_progress(conn: Any, user_id: str | None, concept_ids: list[str]) -> list[dict[str, Any]]:
    ordered_ids = list(dict.fromkeys(concept_ids))
    if not ordered_ids:
        return []

    studied_concept_ids = get_completed_lesson_concept_ids(conn, user_id)
    rows = conn.execute(
        """SELECT concept.id,concept.name,concept.description,
              COUNT(DISTINCT mapping.exercise_id)::int AS total_exercises,
              COUNT(DISTINCT mapping.exercise_id) FILTER (WHERE progress.status='completed')::int AS completed_exercises,
              COUNT(DISTINCT mapping.exercise_id) FILTER (
                WHERE progress.status='completed' AND progress.score>=8
              )::int AS strong_score_exercises,
              COUNT(DISTINCT mapping.exercise_id) FILTER (
                WHERE progress.status IN ('in_progress','completed')
              )::int AS attempted_exercises
            FROM learning_concepts AS concept
            LEFT JOIN exercise_concepts AS mapping ON mapping.concept_id=concept.id
            LEFT JOIN user_progress AS progress
              ON progress.user_id=%s AND progress.item_type='exercise'
             AND progress.item_id=mapping.exercise_id
            WHERE concept.id=ANY(%s)
            GROUP BY concept.id,concept.name,concept.description
            ORDER BY concept.id""",
        (user_id, ordered_ids),
    ).fetchall()

    by_id = {row["id"]: row for row in rows}
    evidence = []
    for concept_id in ordered_ids:
        row = by_id.get(concept_id)
        if not row:
            continue
        completed = row["completed_exercises"]
        attempted = row["attempted_exercises"]
        strong_scores = row["strong_score_exercises"]
        evidence.append({
            "id": concept_id,
            "name": row["name"],
            "description": row["description"],
            "status": "mastered" if strong_scores >= 2 else "demonstrated" if completed else "practicing" if attempted else "studied" if concept_id in studied_concept_ids else "not_assessed",
            "completed_exercises": completed,
            "strong_score_exercises": strong_scores,
            "attempted_exercises": attempted,
            "total_exercises": row["total_exercises"],
        })
    return evidence


def get_completed_lessons(conn: Any, user_id: str | None) -> list[dict[str, Any]]:
    if user_id is None:
        return []
    rows = conn.execute(
        """SELECT lesson.id,lesson.title,progress.completed_at
            FROM user_progress AS progress
            JOIN lessons AS lesson ON lesson.id=progress.item_id
            WHERE progress.user_id=%s AND progress.item_type='lesson' AND progress.status='completed'
            ORDER BY progress.completed_at,lesson.id""",
        (user_id,),
    ).fetchall()
    return [
        {**row, "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None}
        for row in rows
    ]


def get_all_concept_progress(conn: Any, user_id: str | None) -> list[dict[str, Any]]:
    concept_ids = [row["id"] for row in conn.execute(
        "SELECT id FROM learning_concepts ORDER BY id"
    ).fetchall()]
    return get_concept_progress(conn, user_id, concept_ids)
