"""Unit tests for the pure helper functions in app/tutor.py (no database, no OpenAI).

Known defects are marked xfail(strict=True) with their bug ID from docs/testing/,
so the test starts failing loudly once the defect is fixed.
"""
import json

import pytest

from app.tutor import (
    MEMORY_FIELDS,
    _bounded_structured_memory,
    _explicit_learning_preference_updates,
    _lesson_challenges,
    _lesson_summary,
    _render_history,
)


def lesson_content(detail) -> str:
    return "<!-- codora-lesson:v1\n" + json.dumps(detail) + "\n-->\n# Body"


EMPTY_MEMORY = {
    "concepts_understood": [],
    "concepts_to_practice": [],
    "recurring_errors": [],
    "current_goal": "",
    "next_step": "",
}


# ---------------------------------------------------------------------------
# _bounded_structured_memory
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("value", [None, "text", 42, ["a"], {}])
def test_memory_non_dict_or_empty_input_gives_empty_memory(value):
    assert _bounded_structured_memory(value) == EMPTY_MEMORY


def test_memory_always_returns_exactly_the_known_fields():
    result = _bounded_structured_memory({"unexpected": ["x"], "explanation_preference": "short"})
    assert set(result) == set(EMPTY_MEMORY)


def test_memory_list_field_that_is_not_a_list_becomes_empty():
    result = _bounded_structured_memory({"concepts_understood": "loops", "recurring_errors": {"a": 1}})
    assert result["concepts_understood"] == []
    assert result["recurring_errors"] == []


def test_memory_strips_and_drops_blank_or_non_string_items():
    result = _bounded_structured_memory({"concepts_to_practice": ["  loops  ", "", "   ", None, 3, ["x"], "if"]})
    assert result["concepts_to_practice"] == ["loops", "if"]


@pytest.mark.parametrize("field", sorted(MEMORY_FIELDS))
def test_memory_list_field_keeps_at_most_max_items(field):
    maximum_items, _ = MEMORY_FIELDS[field]
    items = [f"item {index}" for index in range(maximum_items + 4)]
    assert _bounded_structured_memory({field: items})[field] == items[:maximum_items]


@pytest.mark.parametrize("field", sorted(MEMORY_FIELDS))
def test_memory_list_item_is_truncated_at_max_length(field):
    _, maximum_length = MEMORY_FIELDS[field]
    result = _bounded_structured_memory({field: ["x" * (maximum_length + 50), "y" * maximum_length]})[field]
    assert [len(item) for item in result] == [maximum_length, maximum_length]


def test_memory_blank_items_do_not_count_towards_item_limit():
    items = ["", "  "] + [f"c{index}" for index in range(6)]
    assert _bounded_structured_memory({"concepts_understood": items})["concepts_understood"] == items[2:]


@pytest.mark.parametrize("field", ["current_goal", "next_step"])
def test_memory_text_field_is_stripped_and_truncated_at_240(field):
    assert _bounded_structured_memory({field: "  finish loop  "})[field] == "finish loop"
    assert len(_bounded_structured_memory({field: "z" * 500})[field]) == 240


@pytest.mark.parametrize("value", [None, 7, ["goal"], {"a": "b"}])
def test_memory_text_field_non_string_becomes_empty(value):
    assert _bounded_structured_memory({"current_goal": value})["current_goal"] == ""


def test_memory_does_not_mutate_input():
    original = {"concepts_understood": ["  a  "] * 10, "current_goal": " g "}
    snapshot = json.loads(json.dumps(original))
    _bounded_structured_memory(original)
    assert original == snapshot


# ---------------------------------------------------------------------------
# _explicit_learning_preference_updates
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("message,expected", [
    # explanation_style
    ("Giải thích từng bước giúp mình", {"explanation_style": "step_by_step"}),
    ("explain step by step please", {"explanation_style": "step_by_step"}),
    ("Please go step-by-step", {"explanation_style": "step_by_step"}),
    ("Giải thích theo khái niệm nhé", {"explanation_style": "conceptual"}),
    ("I prefer a conceptual explanation", {"explanation_style": "conceptual"}),
    ("Hướng dẫn trực tiếp cho mình", {"explanation_style": "direct"}),
    ("Vào thẳng cách làm luôn", {"explanation_style": "direct"}),
    # detail_level
    ("Trả lời ngắn gọn thôi", {"detail_level": "concise"}),
    ("keep it brief", {"detail_level": "concise"}),
    ("Giải thích cân bằng là được", {"detail_level": "balanced"}),
    ("a balanced answer", {"detail_level": "balanced"}),
    ("Mình muốn chi tiết hơn", {"detail_level": "detailed"}),
    ("explain in detail", {"detail_level": "detailed"}),
    # hint_preference
    ("Cho mình gợi ý tăng dần", {"hint_preference": "progressive"}),
    ("Cho từng gợi ý nhỏ thôi", {"hint_preference": "progressive"}),
    ("Chỉ cần gợi ý tối thiểu", {"hint_preference": "minimal"}),
    ("minimal hints please", {"hint_preference": "minimal"}),
    ("Cho mình gợi ý trực tiếp", {"hint_preference": "direct"}),
    ("Nêu thẳng bước cần làm", {"hint_preference": "direct"}),
])
def test_preference_detects_each_supported_value(message, expected):
    assert _explicit_learning_preference_updates(message) == expected


@pytest.mark.parametrize("message", [
    "",
    "Tại sao code của mình sai?",
    "What does this error mean?",
    "def f(x):\n    return x",
])
def test_preference_ordinary_question_gives_no_update(message):
    assert _explicit_learning_preference_updates(message) == {}


def test_preference_is_case_and_diacritic_insensitive():
    expected = {"explanation_style": "step_by_step"}
    assert _explicit_learning_preference_updates("GIẢI THÍCH TỪNG BƯỚC") == expected
    assert _explicit_learning_preference_updates("giai thich tung buoc") == expected


def test_preference_accepts_decomposed_unicode_input():
    import unicodedata
    message = unicodedata.normalize("NFD", "Trả lời ngắn gọn")
    assert _explicit_learning_preference_updates(message) == {"detail_level": "concise"}


def test_preference_one_message_can_update_several_fields():
    result = _explicit_learning_preference_updates("Giải thích từng bước, thật chi tiết, và cho gợi ý tăng dần")
    assert result == {
        "explanation_style": "step_by_step",
        "detail_level": "detailed",
        "hint_preference": "progressive",
    }


def test_preference_only_returns_known_fields_and_values():
    allowed = {
        "explanation_style": {"step_by_step", "conceptual", "direct"},
        "detail_level": {"concise", "balanced", "detailed"},
        "hint_preference": {"progressive", "minimal", "direct"},
    }
    result = _explicit_learning_preference_updates("step by step, concise, minimal, conceptual, detailed")
    assert set(result) <= set(allowed)
    assert all(value in allowed[field] for field, value in result.items())


@pytest.mark.xfail(strict=True, reason="BUG-02: app/tutor.py replaces mojibake 'Ä‘' instead of 'đ', so phrases with 'đ' never match")
@pytest.mark.parametrize("message,expected", [
    ("Giải thích vừa đủ thôi", {"detail_level": "balanced"}),
    ("Đi thẳng vào cách làm", {"explanation_style": "direct"}),
])
def test_preference_phrases_containing_letter_d_stroke(message, expected):
    assert _explicit_learning_preference_updates(message) == expected


# ---------------------------------------------------------------------------
# _render_history
# ---------------------------------------------------------------------------

def test_history_empty():
    assert _render_history([]) == []


def test_history_chat_row_is_rendered_as_is():
    rows = [{"role": "user", "message": "Hi", "code_snapshot": "print(1)", "event_type": "chat"}]
    assert _render_history(rows) == [{"role": "user", "content": "Hi", "submitted_code": "print(1)"}]


def test_history_submission_row_gets_prefix():
    rows = [{"role": "user", "message": '{"status":"Wrong Answer"}', "event_type": "submission"}]
    content = _render_history(rows)[0]["content"]
    assert content == '[Exercise submission result] {"status":"Wrong Answer"}'


def test_history_row_without_event_type_or_code_is_plain():
    rendered = _render_history([{"role": "assistant", "message": "Answer"}])[0]
    assert rendered == {"role": "assistant", "content": "Answer", "submitted_code": ""}


@pytest.mark.parametrize("code_snapshot", [None, ""])
def test_history_missing_code_becomes_empty_string(code_snapshot):
    rows = [{"role": "user", "message": "x", "code_snapshot": code_snapshot}]
    assert _render_history(rows)[0]["submitted_code"] == ""


def test_history_non_string_message_is_converted():
    assert _render_history([{"role": "user", "message": 123}])[0]["content"] == "123"


def test_history_content_is_truncated_at_5000_including_prefix():
    rows = [
        {"role": "user", "message": "a" * 6000},
        {"role": "user", "message": "b" * 6000, "event_type": "submission"},
    ]
    chat, submission = _render_history(rows)
    assert len(chat["content"]) == 5000
    assert len(submission["content"]) == 5000
    assert submission["content"].startswith("[Exercise submission result] ")


def test_history_code_is_truncated_at_10000():
    rows = [{"role": "user", "message": "x", "code_snapshot": "c" * 12000}]
    assert len(_render_history(rows)[0]["submitted_code"]) == 10000


def test_history_keeps_order_and_length():
    rows = [{"role": "user" if index % 2 else "assistant", "message": f"m{index}"} for index in range(10)]
    rendered = _render_history(rows)
    assert [row["content"] for row in rendered] == [f"m{index}" for index in range(10)]
    assert [row["role"] for row in rendered] == [row["role"] for row in rows]


# ---------------------------------------------------------------------------
# _lesson_summary
# ---------------------------------------------------------------------------

def test_summary_uses_description_section_titles_and_first_two_paragraphs():
    content = lesson_content({
        "description": "Learn loops.",
        "sections": [
            {"title": "For loops", "paragraphs": ["P1", "P2", "P3"]},
            {"title": "While loops", "paragraphs": ["W1"]},
        ],
    })
    assert _lesson_summary(content, "Loops") == "Loops: Learn loops. For loops P1 P2 While loops W1"


def test_summary_skips_non_dict_sections_and_non_string_paragraphs():
    content = lesson_content({"description": "D", "sections": ["bad", {"title": "S", "paragraphs": [1, "ok"]}]})
    assert _lesson_summary(content, "T") == "T: D S ok"


def test_summary_is_truncated_at_1800_characters_after_title():
    content = lesson_content({"description": "x" * 3000, "sections": []})
    summary = _lesson_summary(content, "T")
    assert summary == "T: " + "x" * 1800


def test_summary_without_metadata_strips_html_comments():
    summary = _lesson_summary("<!-- hidden -->Plain lesson text", "T")
    assert summary == "T:  Plain lesson text"


def test_summary_without_metadata_is_truncated_at_1400():
    assert _lesson_summary("y" * 2000, "T") == "T: " + "y" * 1400


@pytest.mark.parametrize("content", [None, ""])
def test_summary_handles_missing_content(content):
    assert _lesson_summary(content, "T") == "T: "


def test_summary_invalid_metadata_json_falls_back_to_plain_text():
    content = "<!-- codora-lesson:v1\n{not json}\n-->\nBody"
    assert _lesson_summary(content, "T") == "T:  \nBody"


def test_summary_metadata_must_be_at_start_of_content():
    content = "Intro\n" + lesson_content({"description": "Hidden", "sections": []})
    assert "Hidden" not in _lesson_summary(content, "T")


# ---------------------------------------------------------------------------
# _lesson_challenges
# ---------------------------------------------------------------------------

def test_challenges_extracts_fields_and_visible_cases_only():
    content = lesson_content({"sections": [{
        "title": "Print",
        "challenge": {
            "id": "c1",
            "title": "Say hi",
            "description": "Print hi",
            "initialCode": "# TODO",
            "solutionCode": "print('hi')",
            "testCases": [
                {"id": "t1", "call": "stdout", "expected": "hi", "hidden": True},
                {"call": "stdin", "input": "5", "expected": "5"},
                "not a case",
            ],
        },
    }]})
    assert _lesson_challenges(content) == [{
        "challenge_id": "c1",
        "section": "Print",
        "title": "Say hi",
        "description": "Print hi",
        "starter_code": "# TODO",
        "visible_test_cases": [
            {"call": "stdout", "expected": "hi"},
            {"call": "stdin", "input": "5", "expected": "5"},
        ],
    }]


def test_challenges_never_expose_solution_code():
    content = lesson_content({"sections": [{"title": "S", "challenge": {"id": "c", "solutionCode": "SECRET"}}]})
    assert "SECRET" not in json.dumps(_lesson_challenges(content))


def test_challenges_skip_sections_without_dict_challenge():
    content = lesson_content({"sections": [
        "bad",
        {"title": "No challenge"},
        {"title": "Null", "challenge": None},
        {"title": "String", "challenge": "x"},
        {"title": "Real", "challenge": {"id": "c2"}},
    ]})
    result = _lesson_challenges(content)
    assert [item["challenge_id"] for item in result] == ["c2"]
    assert result[0]["visible_test_cases"] == []


@pytest.mark.parametrize("content", [None, "", "No metadata", "<!-- codora-lesson:v1\n{bad json}\n-->"])
def test_challenges_without_valid_metadata_returns_empty(content):
    assert _lesson_challenges(content) == []


def test_challenges_metadata_without_sections_returns_empty():
    assert _lesson_challenges(lesson_content({"description": "only"})) == []


@pytest.mark.xfail(strict=True, raises=(AttributeError, TypeError),
                   reason="BUG-04: _lesson_challenges crashes on malformed metadata instead of returning []")
@pytest.mark.parametrize("detail", [[1, 2], {"sections": None}])
def test_challenges_malformed_metadata_returns_empty(detail):
    assert _lesson_challenges(lesson_content(detail)) == []


@pytest.mark.parametrize("detail", [[1, 2], {"sections": None}])
def test_summary_tolerates_the_same_malformed_metadata(detail):
    """_lesson_summary already handles the inputs that break _lesson_challenges (BUG-04)."""
    assert _lesson_summary(lesson_content(detail), "T").startswith("T:")
