from app.learning_profile import get_concept_progress


class ConceptProgressConnection:
    def execute(self, query, params):
        if "jsonb_array_elements_text" in query:
            return self._result([{"concept_id": "studied"}])

        return self._result([
            {
                "id": "mastered",
                "name": "Mastered",
                "description": "",
                "total_exercises": 2,
                "completed_exercises": 2,
                "strong_score_exercises": 2,
                "attempted_exercises": 2,
            },
            {
                "id": "demonstrated",
                "name": "Demonstrated",
                "description": "",
                "total_exercises": 2,
                "completed_exercises": 1,
                "strong_score_exercises": 0,
                "attempted_exercises": 1,
            },
            {
                "id": "practicing",
                "name": "Practicing",
                "description": "",
                "total_exercises": 2,
                "completed_exercises": 0,
                "strong_score_exercises": 0,
                "attempted_exercises": 1,
            },
            {
                "id": "studied",
                "name": "Studied",
                "description": "",
                "total_exercises": 2,
                "completed_exercises": 0,
                "strong_score_exercises": 0,
                "attempted_exercises": 0,
            },
            {
                "id": "not-assessed",
                "name": "Not assessed",
                "description": "",
                "total_exercises": 2,
                "completed_exercises": 0,
                "strong_score_exercises": 0,
                "attempted_exercises": 0,
            },
        ])

    @staticmethod
    def _result(rows):
        return type("Result", (), {"fetchall": lambda self: rows})()


def test_concept_status_uses_completed_lesson_as_studied_evidence():
    concepts = get_concept_progress(
        ConceptProgressConnection(),
        "user-1",
        ["mastered", "demonstrated", "practicing", "studied", "not-assessed"],
    )

    assert {concept["id"]: concept["status"] for concept in concepts} == {
        "mastered": "mastered",
        "demonstrated": "demonstrated",
        "practicing": "practicing",
        "studied": "studied",
        "not-assessed": "not_assessed",
    }


def test_anonymous_user_does_not_get_studied_from_user_progress():
    concepts = get_concept_progress(
        ConceptProgressConnection(),
        None,
        ["studied"],
    )

    assert concepts[0]["status"] == "not_assessed"
