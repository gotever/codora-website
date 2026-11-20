import json
from pathlib import Path

from .db import connection, pool

DATA = Path(__file__).resolve().parents[1] / "data" / "curriculum.json"
CONCEPT_DATA = Path(__file__).resolve().parents[1] / "data" / "learning_concepts.json"
HIDDEN_DATA = Path(__file__).resolve().parents[1] / "data" / "hidden_test_cases.json"


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


def challenge_fingerprint(content: str) -> str:
    marker = "<!-- codora-lesson:v1\n"
    metadata_end = content.find("\n-->\n", len(marker))
    if not content.startswith(marker) or metadata_end < 0:
        raise ValueError("Seeded lesson content is missing its versioned metadata block.")
    detail = json.loads(content[len(marker):metadata_end])
    challenges = [
        section["challenge"] for section in detail.get("sections", [])
        if isinstance(section.get("challenge"), dict)
    ]
    return json.dumps(challenges, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


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
    concept_data = json.loads(CONCEPT_DATA.read_text(encoding="utf-8"))
    concepts = concept_data.get("concepts", [])
    concept_ids = {concept.get("id") for concept in concepts if isinstance(concept, dict)}
    if len(concept_ids) != len(concepts) or None in concept_ids:
        raise ValueError("Learning concept IDs must be present and unique.")
    lesson_concepts = concept_data.get("lessons", {})
    exercise_concepts = concept_data.get("exercises", {})
    expected_exercises = {item["id"] for item in data["exercises"]}
    if set(exercise_concepts) != expected_exercises:
        missing = expected_exercises - set(exercise_concepts)
        unexpected = set(exercise_concepts) - expected_exercises
        raise ValueError(f"Exercise concept mapping keys mismatch; missing={sorted(missing)}, unexpected={sorted(unexpected)}")
    for source_key, mapping in lesson_concepts.items():
        if not isinstance(mapping, dict):
            raise ValueError(f"Invalid concept mapping for {source_key!r}.")
        for field in ("preknowledge", "new_concepts"):
            ids = mapping.get(field)
            if not isinstance(ids, list) or any(not isinstance(item, str) for item in ids):
                raise ValueError(f"{source_key!r}.{field} must be an array of concept IDs.")
            unknown_ids = set(ids) - concept_ids
            if unknown_ids:
                raise ValueError(f"Unknown concept IDs in {source_key!r}.{field}: {sorted(unknown_ids)}")
    for exercise_slug, ids in exercise_concepts.items():
        if not isinstance(ids, list) or any(not isinstance(item, str) for item in ids):
            raise ValueError(f"Exercise concept mapping for {exercise_slug!r} must be an array of concept IDs.")
        unknown_ids = set(ids) - concept_ids
        if unknown_ids:
            raise ValueError(f"Unknown concept IDs for exercise {exercise_slug!r}: {sorted(unknown_ids)}")

    pool.open()
    try:
        with connection() as conn:
            with conn.transaction(), conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_xact_lock(73190422)")
                cur.execute("SELECT current_setting('server_encoding') AS server_encoding")
                if cur.fetchone()["server_encoding"].upper() != "UTF8":
                    raise RuntimeError("Curriculum seed requires a UTF8 PostgreSQL database to preserve source content.")

                cur.executemany("""INSERT INTO learning_concepts(id,name,description)
                    VALUES(%s,%s,%s)
                    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description""",
                    [(concept["id"], concept["name"], concept.get("description", "")) for concept in concepts])

                courses = data["courses"]
                navigation = data["courseNavigation"]
                course_rows = [
                    (course["id"], course["title"], course.get("description", course["paceLabel"]), index)
                    for index, course in enumerate(courses, start=1)
                ]
                if navigation["id"] not in {course["id"] for course in courses}:
                    course_rows.append((navigation["id"], navigation["title"], navigation["description"], len(course_rows) + 1))
                course_ids = {}
                for source_key, title, description, order_index in course_rows:
                    row = cur.execute("""INSERT INTO courses(title,description,order_index)
                        VALUES(%s,%s,%s)
                        ON CONFLICT(order_index) DO UPDATE SET title=EXCLUDED.title,
                          description=EXCLUDED.description,order_index=EXCLUDED.order_index
                        RETURNING id""", (title, description, order_index)).fetchone()
                    course_ids[source_key] = row["id"]
                if navigation["id"] not in course_ids:
                    if len(course_ids) != 1:
                        raise ValueError("Course navigation must map to exactly one seeded course.")
                    course_ids[navigation["id"]] = next(iter(course_ids.values()))

                lesson_sources = []
                for course in courses:
                    for index, item in enumerate(course["lessons"], start=1):
                        source_id, content = md_for_course_preview(course, item, index)
                        mapping_key = f"preview:{course['id']}:{index}"
                        mapping = lesson_concepts.get(mapping_key)
                        if mapping is None:
                            raise ValueError(f"Missing concept mapping for {mapping_key!r}.")
                        lesson_sources.append((source_id, item["title"], course_ids[course["id"]], content, index,
                            json.dumps(mapping["preknowledge"]), json.dumps(mapping["new_concepts"])))

                for module in navigation["modules"]:
                    for item in module["lessons"]:
                        lesson = data["lessons"][item["id"]]
                        mapping_key = f"detail:{item['id']}"
                        mapping = lesson_concepts.get(mapping_key)
                        if mapping is None:
                            raise ValueError(f"Missing concept mapping for {mapping_key!r}.")
                        lesson_sources.append((item["id"], item["title"], course_ids[navigation["id"]], md_for_lesson(lesson), int(item["id"]),
                            json.dumps(mapping["preknowledge"]), json.dumps(mapping["new_concepts"])))

                expected_keys = {f"preview:{course['id']}:{index}"
                    for course in courses for index, _item in enumerate(course["lessons"], start=1)}
                expected_keys.update(f"detail:{item['id']}"
                    for module in navigation["modules"] for item in module["lessons"])
                if set(lesson_concepts) != expected_keys:
                    missing = expected_keys - set(lesson_concepts)
                    unexpected = set(lesson_concepts) - expected_keys
                    raise ValueError(f"Lesson concept mapping keys mismatch; missing={sorted(missing)}, unexpected={sorted(unexpected)}")

                # Lesson completion belongs to a particular curriculum. Clear it once when
                # the seeded lesson set or its concept mapping changes, so old completions
                # do not falsely mark the replacement lessons as complete.
                expected_by_order = {}
                for _source_id, title, course_id, _content, order_index, preknowledge, new_concepts in lesson_sources:
                    if course_id == course_ids[navigation["id"]]:
                        expected_by_order[order_index] = (
                            title, json.loads(preknowledge), json.loads(new_concepts), challenge_fingerprint(_content)
                        )
                existing_lessons = cur.execute("""SELECT id,order_index,title,preknowledge,new_concepts,content_markdown
                    FROM lessons WHERE course_id=%s ORDER BY order_index""", (course_ids[navigation["id"]],)).fetchall()
                curriculum_changed = len(existing_lessons) != len(expected_by_order) or any(
                    lesson["order_index"] not in expected_by_order
                    or lesson["title"] != expected_by_order[lesson["order_index"]][0]
                    or lesson["preknowledge"] != expected_by_order[lesson["order_index"]][1]
                    or lesson["new_concepts"] != expected_by_order[lesson["order_index"]][2]
                    or challenge_fingerprint(lesson["content_markdown"]) != expected_by_order[lesson["order_index"]][3]
                    for lesson in existing_lessons
                )
                if curriculum_changed:
                    cur.execute("""DELETE FROM user_progress AS progress
                        USING lessons AS lesson, courses AS course
                        WHERE progress.item_type='lesson' AND progress.item_id=lesson.id
                          AND lesson.course_id=course.id
                          AND (course.id=%s OR course.title='Python foundations')""",
                        (course_ids[navigation["id"]],))
                    cur.execute("""DELETE FROM lesson_challenge_progress AS challenge
                        USING lessons AS lesson, courses AS course
                        WHERE challenge.lesson_id=lesson.id AND lesson.course_id=course.id
                          AND (course.id=%s OR course.title='Python foundations')""",
                        (course_ids[navigation["id"]],))

                lesson_ids = {}
                for source_id, title, course_id, content, order_index, preknowledge, new_concepts in lesson_sources:
                    row = cur.execute("""INSERT INTO lessons(title,course_id,content_markdown,order_index,preknowledge,new_concepts)
                        VALUES(%s,%s,%s,%s,%s::jsonb,%s::jsonb)
                        ON CONFLICT(course_id,order_index) DO UPDATE SET title=EXCLUDED.title,
                          content_markdown=EXCLUDED.content_markdown,preknowledge=EXCLUDED.preknowledge,
                          new_concepts=EXCLUDED.new_concepts
                        RETURNING id""", (title, course_id, content, order_index, preknowledge, new_concepts)).fetchone()
                    lesson_ids[source_id] = row["id"]

                cur.executemany("UPDATE lessons SET content_markdown=%s WHERE id=%s", [
                    (remap_lesson_navigation(content, lesson_ids[source_id], lesson_ids), lesson_ids[source_id])
                    for source_id, _title, _course_id, content, _order_index, _preknowledge, _new_concepts in lesson_sources
                ])

                # Merge progress and exercise links before deleting the retired duplicate course.
                duplicate_courses = cur.execute("""SELECT id FROM courses
                    WHERE title='Python foundations' AND id<>%s""", (course_ids[navigation["id"]],)).fetchall()
                for duplicate in duplicate_courses:
                    cur.execute("""INSERT INTO user_progress(user_id,item_type,item_id,status,completed_at)
                        SELECT progress.user_id,'lesson',target.id,
                          CASE WHEN bool_or(progress.status='completed') THEN 'completed'
                            WHEN bool_or(progress.status='in_progress') THEN 'in_progress' ELSE 'not_started' END,
                          CASE WHEN bool_or(progress.status='completed')
                            THEN COALESCE(max(progress.completed_at),now()) ELSE NULL END
                        FROM user_progress AS progress
                        JOIN lessons AS old_lesson ON old_lesson.id=progress.item_id
                        JOIN lessons AS target ON target.course_id=%s AND target.order_index=old_lesson.order_index
                        WHERE progress.item_type='lesson' AND old_lesson.course_id=%s
                        GROUP BY progress.user_id,target.id
                        ON CONFLICT(user_id,item_type,item_id) DO UPDATE SET
                          status=CASE WHEN user_progress.status='completed' OR EXCLUDED.status='completed'
                            THEN 'completed' WHEN user_progress.status='in_progress' OR EXCLUDED.status='in_progress'
                            THEN 'in_progress' ELSE 'not_started' END,
                          completed_at=CASE WHEN user_progress.status='completed' OR EXCLUDED.status='completed'
                            THEN COALESCE(user_progress.completed_at,EXCLUDED.completed_at,now()) ELSE NULL END""",
                        (course_ids[navigation["id"]], duplicate["id"]))
                    cur.execute("""DELETE FROM user_progress AS progress
                        USING lessons AS old_lesson
                        WHERE progress.item_type='lesson' AND progress.item_id=old_lesson.id
                          AND old_lesson.course_id=%s""", (duplicate["id"],))
                    cur.execute("""UPDATE exercises AS exercise SET lesson_id=target.id
                        FROM lessons AS old_lesson
                        JOIN lessons AS target ON target.course_id=%s AND target.order_index=old_lesson.order_index
                        WHERE exercise.lesson_id=old_lesson.id AND old_lesson.course_id=%s""",
                        (course_ids[navigation["id"]], duplicate["id"]))
                    cur.execute("DELETE FROM courses WHERE id=%s", (duplicate["id"],))

                hidden_cases = {}
                if HIDDEN_DATA.exists():
                    hidden_cases = json.loads(HIDDEN_DATA.read_text(encoding="utf-8"))

                exercise_rows = []
                for exercise in data["exercises"]:
                    # Keep the separate exercise workspace linked to the closest matching lesson.
                    if exercise["functionName"] in ("reverse_string", "count_vowels", "is_palindrome"):
                        lesson_id = lesson_ids["5"]
                    else:
                        lesson_id = lesson_ids["6"]
                    exercise_rows.append((exercise["id"], lesson_id, exercise["title"], exercise["difficulty"],
                        exercise["description"], exercise["functionName"], exercise["initialCode"],
                        json.dumps({"runner": data["testCases"][exercise["id"]],
                            "hidden": hidden_cases.get(exercise["id"], []),
                            "slug": exercise["id"],
                            "examples": exercise["examples"],
                            "constraints": exercise["constraints"], "functionSignature": exercise["functionSignature"],
                            "number": exercise["number"], "total": exercise["total"], "filename": exercise["filename"],
                            "courseId": exercise["courseId"], "courseTitle": exercise["courseTitle"]}),
                        json.dumps(exercise["hints"]), json.dumps(exercise["tags"])))
                for row in exercise_rows:
                    (exercise_slug, lesson_id, title, difficulty, description, function_name, starter_code,
                     test_cases, hints, tags) = row
                    matches = cur.execute("SELECT id FROM exercises WHERE title=%s AND function_name=%s", (title, function_name)).fetchall()
                    if len(matches) > 1:
                        raise RuntimeError(f"Multiple exercise rows match seeded exercise {title!r}.")
                    if matches:
                        cur.execute("""UPDATE exercises SET lesson_id=%s,title=%s,difficulty=%s,description=%s,
                            function_name=%s,starter_code=%s,test_cases=%s::jsonb,hints=%s::jsonb,tags=%s::jsonb
                            WHERE id=%s""", (lesson_id, title, difficulty, description, function_name,
                            starter_code, test_cases, hints, tags, matches[0]["id"]))
                        exercise_id = matches[0]["id"]
                    else:
                        exercise_id = cur.execute("""INSERT INTO exercises(lesson_id,title,difficulty,description,function_name,
                            starter_code,test_cases,hints,tags)
                            VALUES(%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb)""",
                            (lesson_id, title, difficulty, description, function_name,
                             starter_code, test_cases, hints, tags)).fetchone()["id"]
                    cur.execute("DELETE FROM exercise_concepts WHERE exercise_id=%s", (exercise_id,))
                    cur.executemany("INSERT INTO exercise_concepts(exercise_id,concept_id) VALUES(%s,%s)", [
                        (exercise_id, concept_id) for concept_id in exercise_concepts[exercise_slug]
                    ])
                cur.execute("DELETE FROM lessons WHERE course_id=%s AND order_index>9", (course_ids[navigation["id"]],))
        print(f"Seeded {len(course_rows)} courses, {len(lesson_sources)} lessons, {len(exercise_rows)} exercises, {len(concepts)} concepts, and {sum(len(ids) for ids in exercise_concepts.values())} exercise-concept links.")
    finally:
        pool.close()


if __name__ == "__main__":
    main()
