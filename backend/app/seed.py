import json
from pathlib import Path

from .db import connection, pool

DATA = Path(__file__).resolve().parents[1] / "data" / "curriculum.json"


def md_for_lesson(lesson: dict) -> str:
    lines = [f"# {lesson['title']}", "", lesson["description"], ""]
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


def main() -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    pool.open()
    try:
        with connection() as conn:
            with conn.transaction(), conn.cursor() as cur:
                cur.execute("SELECT current_setting('server_encoding') AS server_encoding")
                if cur.fetchone()["server_encoding"].upper() != "UTF8":
                    raise RuntimeError("Curriculum seed requires a UTF8 PostgreSQL database to preserve source content.")

                courses = data["courses"]
                navigation = data["courseNavigation"]
                course_rows = [
                    (course["id"], course["title"], "Python lessons from the existing Codora curriculum.", index)
                    for index, course in enumerate(courses, start=1)
                ]
                course_rows.append((navigation["id"], navigation["title"], navigation["description"], 3))
                cur.executemany("""INSERT INTO courses(id,title,description,order_index) VALUES(%s,%s,%s,%s)
                    ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,order_index=EXCLUDED.order_index""", course_rows)

                lesson_rows = []
                for module in navigation["modules"]:
                    for item in module["lessons"]:
                        lesson = data["lessons"][item["id"]]
                        lesson_rows.append((item["id"], item["title"], navigation["id"], md_for_lesson(lesson), int(item["id"])))
                cur.executemany("""INSERT INTO lessons(id,title,course_id,content_markdown,order_index) VALUES(%s,%s,%s,%s,%s)
                    ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,course_id=EXCLUDED.course_id,
                    content_markdown=EXCLUDED.content_markdown,order_index=EXCLUDED.order_index""", lesson_rows)

                exercise_rows = []
                for exercise in data["exercises"]:
                    # No canonical exercise-to-lesson mapping exists in the source data. These
                    # assignments are provisional to satisfy the lesson FK; see backend/README.md.
                    if exercise["functionName"] in ("reverse_string", "count_vowels"):
                        lesson_id = "3"
                    else:
                        lesson_id = "7"
                    exercise_rows.append((exercise["id"], lesson_id, exercise["title"], exercise["difficulty"],
                        exercise["description"], exercise["functionName"], exercise["initialCode"],
                        json.dumps({"runner": data["testCases"][exercise["id"]], "examples": exercise["examples"],
                            "constraints": exercise["constraints"], "functionSignature": exercise["functionSignature"],
                            "number": exercise["number"], "total": exercise["total"], "filename": exercise["filename"],
                            "courseId": exercise["courseId"], "courseTitle": exercise["courseTitle"]}),
                        json.dumps(exercise["hints"]), json.dumps(exercise["tags"])))
                cur.executemany("""INSERT INTO exercises(id,lesson_id,title,difficulty,description,function_name,starter_code,test_cases,hints,tags)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb)
                    ON CONFLICT(id) DO UPDATE SET lesson_id=EXCLUDED.lesson_id,title=EXCLUDED.title,
                    difficulty=EXCLUDED.difficulty,description=EXCLUDED.description,function_name=EXCLUDED.function_name,
                    starter_code=EXCLUDED.starter_code,test_cases=EXCLUDED.test_cases,hints=EXCLUDED.hints,tags=EXCLUDED.tags""", exercise_rows)
        print(f"Seeded {len(course_rows)} courses, {len(lesson_rows)} lessons, and {len(exercise_rows)} exercises.")
    finally:
        pool.close()


if __name__ == "__main__":
    main()
