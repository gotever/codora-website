import json
from pathlib import Path

from .db import connection, pool

DATA = Path(__file__).resolve().parents[1] / "data" / "curriculum.json"


def md_for_lesson(lesson: dict) -> str:
    metadata = json.dumps(lesson, ensure_ascii=False, separators=(",", ":"))
    lines = ["<!-- codora-lesson:v1", metadata, "-->", "", f"# {lesson['title']}", "", lesson["description"], ""]
    for section in lesson["sections"]:
        lines.extend([f"## {section['title']}", ""])
        lines.extend([paragraph for paragraph in section["paragraphs"]])
        lines.append("")
        example = section.get("codeExample")
        if example:
            lines.extend([f"**{example.get('caption', example['filename'])}**", "", f"```{example['language'].lower()}", example["code"], "```", ""])
        challenge = section.get("challenge")
        if challenge:
            lines.extend([f"### {challenge['title']}", "", challenge["description"], "", f"```python", challenge["initialCode"], "```", ""])
            for case in challenge["testCases"]:
                lines.append(f"- `{case['call']}` → `{case['expected']}`")
        takeaway = section.get("takeaway")
        if takeaway:
            lines.extend([f"**{takeaway['label']}:** {takeaway['text']}", ""])
    return "\n".join(lines).strip()


def remap_lesson_navigation(content: str, lesson_id: int, lesson_ids: dict[str, int]) -> str:
    marker = "<!-- codora-lesson:v1\n"
    metadata_end = content.find("\n-->\n", len(marker))
    if not content.startswith(marker) or metadata_end < 0:
        raise ValueError("Seeded lesson content is missing its versioned metadata block.")

    detail = json.loads(content[len(marker):metadata_end])
    detail["id"] = str(lesson_id)
    for key in ("prevLesson", "nextLesson"):
        navigation = detail.get(key)
        if navigation and navigation.get("id") in lesson_ids:
            navigation["id"] = str(lesson_ids[navigation["id"]])
    return marker + json.dumps(detail, ensure_ascii=False, separators=(",", ":")) + content[metadata_end:]


def md_for_course_preview(course: dict, item: dict, number: int) -> tuple[str, str]:
    lesson_id = f"{course['id']}-{number}"
    detail = {
        "id": lesson_id,
        "lessonNumber": number,
        "moduleNumber": "01",
        "moduleName": course["title"].upper(),
        "topic": item["title"],
        "title": item["title"],
        "description": item["description"],
        "duration": "Self-paced",
        "exerciseCount": 0,
        "language": "Python",
        "status": "upcoming",
        "sections": [{
            "id": f"{lesson_id}-overview",
            "number": "01",
            "title": item["title"],
            "paragraphs": [item["description"]],
        }],
    }
    if number > 1:
        previous = course["lessons"][number - 2]
        detail["prevLesson"] = {
            "id": f"{course['id']}-{number - 1}",
            "title": previous["title"],
        }
    if number < len(course["lessons"]):
        following = course["lessons"][number]
        detail["nextLesson"] = {
            "id": f"{course['id']}-{number + 1}",
            "title": following["title"],
        }
    return lesson_id, md_for_lesson(detail)


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    pool.open()
    try:
        with connection() as conn:
            with conn.transaction(), conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_xact_lock(73190422)")
                cur.execute("SELECT current_setting('server_encoding') AS server_encoding")
                if cur.fetchone()["server_encoding"].upper() != "UTF8":
                    raise RuntimeError("Curriculum seed requires a UTF8 PostgreSQL database to preserve source content.")

                courses = data["courses"]
                navigation = data["courseNavigation"]
                course_rows = [
                    (course["id"], course["title"], course.get("description", course["paceLabel"]), index)
                    for index, course in enumerate(courses, start=1)
                ]
                course_rows.append((navigation["id"], navigation["title"], navigation["description"], 3))
                course_ids = {}
                for source_key, title, description, order_index in course_rows:
                    row = cur.execute("""INSERT INTO courses(title,description,order_index)
                        VALUES(%s,%s,%s)
                        ON CONFLICT(order_index) DO UPDATE SET title=EXCLUDED.title,
                          description=EXCLUDED.description,order_index=EXCLUDED.order_index
                        RETURNING id""", (title, description, order_index)).fetchone()
                    course_ids[source_key] = row["id"]

                lesson_sources = []
                for course in courses:
                    for index, item in enumerate(course["lessons"], start=1):
                        source_id, content = md_for_course_preview(course, item, index)
                        lesson_sources.append((source_id, item["title"], course_ids[course["id"]], content, index))

                for module in navigation["modules"]:
                    for item in module["lessons"]:
                        lesson = data["lessons"][item["id"]]
                        lesson_sources.append((item["id"], item["title"], course_ids[navigation["id"]], md_for_lesson(lesson), int(item["id"])))

                lesson_ids = {}
                for source_id, title, course_id, content, order_index in lesson_sources:
                    row = cur.execute("""INSERT INTO lessons(title,course_id,content_markdown,order_index)
                        VALUES(%s,%s,%s,%s)
                        ON CONFLICT(course_id,order_index) DO UPDATE SET title=EXCLUDED.title,
                          content_markdown=EXCLUDED.content_markdown
                        RETURNING id""", (title, course_id, content, order_index)).fetchone()
                    lesson_ids[source_id] = row["id"]

                cur.executemany("UPDATE lessons SET content_markdown=%s WHERE id=%s", [
                    (remap_lesson_navigation(content, lesson_ids[source_id], lesson_ids), lesson_ids[source_id])
                    for source_id, _title, _course_id, content, _order_index in lesson_sources
                ])

                exercise_rows = []
                for exercise in data["exercises"]:
                    # No canonical exercise-to-lesson mapping exists in the source data. These
                    # assignments are provisional to satisfy the lesson FK; see backend/README.md.
                    if exercise["functionName"] in ("reverse_string", "count_vowels"):
                        lesson_id = lesson_ids["3"]
                    else:
                        lesson_id = lesson_ids["7"]
                    exercise_rows.append((lesson_id, exercise["title"], exercise["difficulty"],
                        exercise["description"], exercise["functionName"], exercise["initialCode"],
                        json.dumps({"runner": data["testCases"][exercise["id"]], "examples": exercise["examples"],
                            "constraints": exercise["constraints"], "functionSignature": exercise["functionSignature"],
                            "number": exercise["number"], "total": exercise["total"], "filename": exercise["filename"],
                            "courseId": exercise["courseId"], "courseTitle": exercise["courseTitle"]}),
                        json.dumps(exercise["hints"]), json.dumps(exercise["tags"])))
                for row in exercise_rows:
                    (lesson_id, title, difficulty, description, function_name, starter_code,
                     test_cases, hints, tags) = row
                    matches = cur.execute("SELECT id FROM exercises WHERE title=%s AND function_name=%s", (title, function_name)).fetchall()
                    if len(matches) > 1:
                        raise RuntimeError(f"Multiple exercise rows match seeded exercise {title!r}.")
                    if matches:
                        cur.execute("""UPDATE exercises SET lesson_id=%s,title=%s,difficulty=%s,description=%s,
                            function_name=%s,starter_code=%s,test_cases=%s::jsonb,hints=%s::jsonb,tags=%s::jsonb
                            WHERE id=%s""", (lesson_id, title, difficulty, description, function_name,
                            starter_code, test_cases, hints, tags, matches[0]["id"]))
                    else:
                        cur.execute("""INSERT INTO exercises(lesson_id,title,difficulty,description,function_name,
                            starter_code,test_cases,hints,tags)
                            VALUES(%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb)""",
                            (lesson_id, title, difficulty, description, function_name,
                             starter_code, test_cases, hints, tags))
        print(f"Seeded {len(course_rows)} courses, {len(lesson_sources)} lessons, and {len(exercise_rows)} exercises.")
    finally:
        pool.close()


if __name__ == "__main__":
    main()
