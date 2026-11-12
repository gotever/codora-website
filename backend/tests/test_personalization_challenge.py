import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app import personalization


def _lesson(challenge=None):
    section = {
        "id": "section-1",
        "number": "01",
        "title": "Print values",
        "paragraphs": ["Use print to display a value."],
    }
    if challenge is not None:
        section["challenge"] = challenge
    detail = {
        "title": "Printing",
        "description": "Display values with Python.",
        "language": "Python",
        "exerciseCount": 0,
        "sections": [section],
    }
    return "<!-- codora-lesson:v1\n" + json.dumps(detail) + "\n-->\n"


def _mock_openai(output):
    api = SimpleNamespace(responses=SimpleNamespace(create=lambda **_kwargs: SimpleNamespace(
        output_text=json.dumps(output), usage=None,
    )))
    return lambda **_kwargs: api


def _setup_model(monkeypatch, payload):
    monkeypatch.setattr(personalization.settings, "openai_api_key", "test-key")
    monkeypatch.setattr(personalization, "get_user_ability", lambda *_: SimpleNamespace(
        model_dump=lambda: {"level": "beginner", "recent_quiz_avg": 0},
    ))
    monkeypatch.setattr(personalization, "OpenAI", _mock_openai(payload))
    monkeypatch.setattr(personalization, "write_llm_trace", lambda **_kwargs: None)


def _section_response(challenge):
    return {"sections": [{
        "id": "section-1",
        "paragraphs": ["Print displays text."],
        "visual_example": None,
        "takeaway_text": None,
        "challenge": challenge,
    }]}


def test_personalization_adds_level_matched_challenge_when_lesson_has_none(monkeypatch):
    generated = {
        "title": "Print a greeting",
        "description": "Change the value and print the greeting.",
        "practiceLabel": "Beginner practice",
        "filename": "greeting.py",
        "initialCode": 'name = "Mina"  # Try changing this input\n# TODO: print a greeting using name\n',
        "testCases": [{"expected": "Hello, Mina!"}],
    }
    _setup_model(monkeypatch, _section_response(generated))

    content, _ability = personalization.personalize_lesson(_lesson(), None, 0)
    detail = json.loads(personalization.DETAIL_MARKER.match(content).group(1))
    challenge = detail["sections"][0]["challenge"]
    assert challenge["id"] == "ai-section-1"
    assert challenge["testCases"] == [{"id": "ai-case-section-1", "call": "stdout", "expected": "Hello, Mina!"}]
    assert "solutionCode" not in challenge
    assert detail["exerciseCount"] == 1


def test_personalization_preserves_existing_challenge(monkeypatch):
    existing = {"id": "existing", "title": "Existing", "initialCode": "print(1)", "testCases": []}
    _setup_model(monkeypatch, _section_response(None))

    content, _ability = personalization.personalize_lesson(_lesson(existing), None, 0)
    detail = json.loads(personalization.DETAIL_MARKER.match(content).group(1))
    assert detail["sections"][0]["challenge"] == existing


def test_personalization_fails_if_model_omits_required_challenge(monkeypatch):
    _setup_model(monkeypatch, _section_response(None))
    with pytest.raises(HTTPException) as error:
        personalization.personalize_lesson(_lesson(), None, 0)
    assert error.value.status_code == 502
