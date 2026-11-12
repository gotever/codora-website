import json
import logging
import re
import time

from fastapi import HTTPException
from openai import OpenAI, OpenAIError

from .db import connection
from .llm_trace import write_llm_trace
from .schemas import UserAbilitySchema
from .settings import settings

DETAIL_MARKER = re.compile(r"\A<!-- codora-lesson:v1\r?\n([\s\S]*?)\r?\n-->\r?\n?")
logger = logging.getLogger(__name__)


def get_user_ability(user_id: str | None, consecutive_errors: int) -> UserAbilitySchema:
    if user_id is None:
        return UserAbilitySchema(
            level="beginner", mastered_topics=[], recent_quiz_avg=0.0,
            consecutive_errors=consecutive_errors,
        )

    with connection() as conn:
        user = conn.execute("SELECT level FROM users WHERE id=%s", (user_id,)).fetchone()
        if not user:
            raise HTTPException(401, "Authentication required")
        topics = conn.execute("""
            SELECT DISTINCT COALESCE(lesson.title, exercise.title) AS topic
            FROM user_progress AS progress
            LEFT JOIN lessons AS lesson
              ON progress.item_type='lesson' AND lesson.id=progress.item_id
            LEFT JOIN exercises AS exercise
              ON progress.item_type='exercise' AND exercise.id=progress.item_id
            WHERE progress.user_id=%s AND progress.status='completed'
              AND COALESCE(lesson.title, exercise.title) IS NOT NULL
            ORDER BY topic
        """, (user_id,)).fetchall()
        quiz_average = conn.execute("""
            SELECT COALESCE(AVG(score), 0)::float AS average
            FROM (
              SELECT score FROM user_progress
              WHERE user_id=%s AND item_type='exercise' AND score IS NOT NULL
              ORDER BY last_attempt_at DESC NULLS LAST, id DESC
              LIMIT 5
            ) AS recent_scores
        """, (user_id,)).fetchone()["average"]

    return UserAbilitySchema(
        level=user["level"],
        mastered_topics=[row["topic"] for row in topics],
        recent_quiz_avg=quiz_average,
        consecutive_errors=consecutive_errors,
    )


def personalize_lesson(content_markdown: str, user_id: str | None, consecutive_errors: int) -> tuple[str, UserAbilitySchema]:
    api_key = settings.openai_api_key.strip()
    if not api_key or api_key.lower().startswith("replace-"):
        raise HTTPException(503, "Lesson personalization is not configured")

    match = DETAIL_MARKER.match(content_markdown)
    if not match:
        raise HTTPException(422, "Lesson content has no supported metadata block")
    try:
        lesson = json.loads(match.group(1))
    except json.JSONDecodeError:
        raise HTTPException(422, "Lesson content metadata is invalid") from None
    sections = lesson.get("sections")
    if not isinstance(sections, list) or not sections:
        raise HTTPException(422, "Lesson has no sections to personalize")

    ability = get_user_ability(user_id, consecutive_errors)
    section_source = [
        {
            "id": section.get("id"),
            "number": section.get("number"),
            "title": section.get("title"),
            "paragraphs": section.get("paragraphs", []),
            "codeExample": section.get("codeExample"),
            "takeaway": section.get("takeaway"),
            "has_challenge": isinstance(section.get("challenge"), dict),
        }
        for section in sections
    ]
    has_challenge = any(item["has_challenge"] for item in section_source)
    instructions = """You adapt programming lessons for one learner. Keep the lesson skeleton exactly the same: same number and order of sections, section IDs, section titles, and main learning objectives. Adapt explanations, illustrative non-challenge examples, and takeaway text to the learner profile. Keep all code examples valid Python and consistent with lesson facts. Include one output item per input section in the same order. Return JSON only with this shape: {"sections":[{"id":"existing section id","paragraphs":["..."],"visual_example":{"filename":"example.py","language":"Python","code":"...","caption":"..."} or null,"takeaway_text":"..." or null,"challenge":null or {"title":"...","description":"...","practiceLabel":"...","filename":"...","initialCode":"...","testCases":[{"expected":"exact stdout for a correct solution"}]}}]}. If the lesson already has any interactive challenge, set challenge to null for every output section; existing challenges must remain unchanged. If the lesson has no interactive challenge, create exactly one new challenge in the section where it best reinforces the taught concept, and set challenge to null in all other sections. Match the task difficulty to the learner profile and recent performance: beginner tasks should be small and guided, intermediate tasks should combine concepts, and advanced tasks can require edge-case reasoning. Low scores or repeated errors mean simpler scaffolding; strong results permit more demanding work. The challenge must run in the existing browser Python editor: use one deterministic stdout test case, provide starter code with a clearly editable input value and TODO, and make expected output the exact stdout of a correct solution. Do not use input() or depend on stdin, files, network, or extra packages. Starter code must not contain the completed solution. Do not include a solution in the generated challenge. Do not add or remove sections. Use readable, direct learner-facing language."""
    user_input = {
        "output_format": "Respond with valid JSON only, using a top-level sections array.",
        "lesson_has_challenge": has_challenge,
        "learner_profile": ability.model_dump(),
        "lesson": {
            "title": lesson.get("title"),
            "description": lesson.get("description"),
            "language": lesson.get("language"),
            "sections": section_source,
        },
    }

    started_at = time.perf_counter()
    response = None
    try:
        response = OpenAI(api_key=api_key, timeout=90.0, max_retries=1).responses.create(
            model=settings.openai_model,
            instructions=instructions,
            input=json.dumps(user_input, ensure_ascii=False),
            text={"format": {"type": "json_object"}},
            max_output_tokens=4000,
            store=False,
        )
        rewrite = json.loads(response.output_text)
    except OpenAIError as exc:
        write_llm_trace(
            operation="lesson_personalization",
            model=settings.openai_model,
            instructions=instructions,
            input_data=user_input,
            elapsed_ms=(time.perf_counter() - started_at) * 1000,
            usage=getattr(response, "usage", None),
            error=type(exc).__name__,
        )
        body = getattr(exc, "body", None)
        api_error = body.get("error", body) if isinstance(body, dict) else None
        api_message = api_error.get("message") if isinstance(api_error, dict) else None
        logger.warning(
            "OpenAI lesson rewrite failed: error=%s status=%s code=%s param=%s request_id=%s message=%s",
            type(exc).__name__, getattr(exc, "status_code", None), getattr(exc, "code", None),
            getattr(exc, "param", None), getattr(exc, "request_id", None),
            str(api_message)[:240] if api_message else None,
        )
        raise HTTPException(502, "The lesson could not be personalized right now") from None
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        write_llm_trace(
            operation="lesson_personalization",
            model=settings.openai_model,
            instructions=instructions,
            input_data=user_input,
            elapsed_ms=(time.perf_counter() - started_at) * 1000,
            usage=getattr(response, "usage", None),
            error=type(exc).__name__,
        )
        logger.warning("OpenAI lesson rewrite returned invalid JSON (%s)", type(exc).__name__)
        raise HTTPException(502, "The lesson could not be personalized right now") from None

    write_llm_trace(
        operation="lesson_personalization",
        model=settings.openai_model,
        instructions=instructions,
        input_data=user_input,
        elapsed_ms=(time.perf_counter() - started_at) * 1000,
        usage=getattr(response, "usage", None),
    )

    rewritten_sections = rewrite.get("sections") if isinstance(rewrite, dict) else None
    if not isinstance(rewritten_sections, list) or len(rewritten_sections) != len(sections):
        raise HTTPException(502, "The lesson model returned an invalid structure")

    generated_challenge_count = 0
    for original, rewritten in zip(sections, rewritten_sections):
        if not isinstance(rewritten, dict) or rewritten.get("id") != original.get("id"):
            raise HTTPException(502, "The lesson model changed the section structure")
        paragraphs = rewritten.get("paragraphs")
        if not isinstance(paragraphs, list) or not paragraphs or not all(isinstance(text, str) and text.strip() for text in paragraphs):
            raise HTTPException(502, "The lesson model returned invalid explanations")
        original["paragraphs"] = paragraphs

        example = rewritten.get("visual_example")
        if isinstance(example, dict):
            required = ("filename", "language", "code", "caption")
            if not all(isinstance(example.get(key), str) and example[key].strip() for key in required):
                raise HTTPException(502, "The lesson model returned an invalid code example")
            original["codeExample"] = {
                "filename": example["filename"], "language": example["language"],
                "code": example["code"], "caption": example["caption"],
            }

        generated_challenge = rewritten.get("challenge")
        if not has_challenge and isinstance(generated_challenge, dict):
            required = ("title", "description", "practiceLabel", "filename", "initialCode")
            if not all(isinstance(generated_challenge.get(key), str) and generated_challenge[key].strip() for key in required):
                raise HTTPException(502, "The lesson model returned an invalid challenge")
            test_cases = generated_challenge.get("testCases")
            if (
                not isinstance(test_cases, list)
                or len(test_cases) != 1
                or not isinstance(test_cases[0], dict)
                or not isinstance(test_cases[0].get("expected"), str)
                or not test_cases[0]["expected"].strip()
            ):
                raise HTTPException(502, "The lesson model returned invalid challenge output")
            original["challenge"] = {
                "id": f"ai-{original.get('id')}",
                "title": generated_challenge["title"],
                "description": generated_challenge["description"],
                "practiceLabel": generated_challenge["practiceLabel"],
                "filename": generated_challenge["filename"],
                "language": "Python",
                "initialCode": generated_challenge["initialCode"],
                "testCases": [{"id": f"ai-case-{original.get('id')}", "call": "stdout", "expected": test_cases[0]["expected"]}],
            }
            generated_challenge_count += 1

        takeaway_text = rewritten.get("takeaway_text")
        if isinstance(original.get("takeaway"), dict) and isinstance(takeaway_text, str) and takeaway_text.strip():
            original["takeaway"]["text"] = takeaway_text

    if not has_challenge and generated_challenge_count != 1:
        raise HTTPException(502, "The lesson model did not return exactly one interactive challenge")
    if generated_challenge_count:
        try:
            lesson["exerciseCount"] = int(lesson.get("exerciseCount", 0)) + generated_challenge_count
        except (TypeError, ValueError):
            lesson["exerciseCount"] = generated_challenge_count

    new_metadata = json.dumps(lesson, ensure_ascii=False, separators=(",", ":"))
    personalized = content_markdown[:match.start(1)] + new_metadata + content_markdown[match.end(1):]
    try:
        json.loads(DETAIL_MARKER.match(personalized).group(1))  # type: ignore[union-attr]
    except (AttributeError, json.JSONDecodeError, TypeError):
        raise HTTPException(502, "The personalized lesson could not be validated") from None
    return personalized, ability
