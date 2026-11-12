import json
from contextlib import contextmanager
from types import SimpleNamespace

from app import tutor
from app.schemas import TutorChatInput


class FakeConnection:
    def __init__(self):
        self.writes = []
        self.history = [
            {"role": "user", "message": f"Question {index}", "code_snapshot": None, "event_type": "chat"}
            for index in range(1, 10)
        ]
        self.history.insert(1, {
            "role": "user", "message": '{"status":"Wrong Answer"}',
            "code_snapshot": "print('oops')", "event_type": "submission",
        })

    def execute(self, query, params=()):
        if "SELECT id,level,ai_tutor_memory" in query:
            return SimpleNamespace(fetchone=lambda: {
                "id": "learner-id", "level": "beginner",
                "ai_tutor_memory": {"exercise:7": {
                    "summary": "Learner is practicing loops.", "summarized_count": 1,
                    "structured": {"concepts_to_practice": ["loop boundaries"]},
                }},
            })
        if "FROM exercises e JOIN lessons" in query:
            return SimpleNamespace(fetchone=lambda: {
                "id": 7, "title": "Sum even numbers", "description": "Return the sum of even list values.",
                "function_name": "sum_even", "lesson_id": 2, "lesson_title": "Loops",
                "content_markdown": "<!-- codora-lesson:v1\n{\"description\":\"Loop lesson\",\"sections\":[]}\n-->\n",
            })
        if "SELECT role,message,code_snapshot,event_type FROM ai_chats" in query:
            return SimpleNamespace(fetchall=lambda: self.history)
        if "SELECT status,score FROM user_progress" in query:
            return SimpleNamespace(fetchone=lambda: {"status": "in_progress", "score": 4.0})
        if "SELECT DISTINCT COALESCE(l.title,e.title)" in query:
            return SimpleNamespace(fetchall=lambda: [{"topic": "Variables"}])
        if "SELECT COALESCE(AVG(score),0)::float" in query:
            return SimpleNamespace(fetchone=lambda: {"average": 4.0})
        self.writes.append((query, params))
        return SimpleNamespace(fetchone=lambda: None, fetchall=lambda: [])


def test_tutor_uses_recent_window_and_submission_events_and_persists_bounded_memory(monkeypatch):
    fake_db = FakeConnection()

    @contextmanager
    def fake_connection():
        yield fake_db

    captured = {}
    output = {
        "answer": "Check how your loop handles an even number.",
        "summary": "x" * 540,
        "structured_memory": {
            "concepts_understood": ["variables"],
            "concepts_to_practice": ["loop boundaries"],
            "recurring_errors": ["returned inside loop"],
            "explanation_preference": "small examples",
            "current_goal": "finish sum_even",
            "next_step": "move return outside loop",
        },
    }
    fake_api = SimpleNamespace(responses=SimpleNamespace(create=lambda **kwargs: (
        captured.update(kwargs) or SimpleNamespace(output_text=json.dumps(output), usage=None)
    )))
    monkeypatch.setattr(tutor, "connection", fake_connection)
    monkeypatch.setattr(tutor, "OpenAI", lambda **_kwargs: fake_api)
    monkeypatch.setattr(tutor.settings, "openai_api_key", "test-key")

    result = tutor.create_tutor_reply("learner-id", TutorChatInput(
        context_type="exercise", context_id=7, message="Why did this fail?",
        code_snapshot="def sum_even(values):\n    return 0",
        activity="Wrong Answer, 1 of 4 tests passed.",
    ))

    request = json.loads(captured["input"])
    assert len(request["recent_messages"]) == 8
    assert request["new_messages_to_absorb_into_summary"][0]["content"].startswith("[Exercise submission result]")
    assert request["learner_profile"]["level"] == "beginner"
    assert request["current_activity"] == "Wrong Answer, 1 of 4 tests passed."
    assert len(result["memory_summary"]) == 500
    update = next(params for query, params in fake_db.writes if "UPDATE users SET ai_tutor_memory" in query)
    stored_memory = json.loads(update[0])
    assert len(stored_memory["exercise:7"]["summary"]) == 500
    assert sum("INSERT INTO ai_chats" in query for query, _ in fake_db.writes) == 1
