"""Append learner AI chat and exercise submission traces to the local workspace."""

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)
_TRACE_PATH = Path(__file__).resolve().parents[2] / "trace_chat.txt"
_TRACE_LOCK = threading.Lock()


def write_interaction_trace(
    *,
    event: str,
    user_id: str | None,
    context: dict[str, Any],
    input_data: Any,
    output_data: Any = None,
    error: str | None = None,
) -> None:
    """Append one JSON record. Trace failures must not interrupt learning flows."""
    record = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "event": event,
        "user_id": user_id,
        "context": context,
        "status": "error" if error else "success",
        "input": input_data,
        "output": output_data,
        "error": error,
    }

    try:
        rendered = "\n" + "=" * 80 + "\n"
        rendered += json.dumps(record, ensure_ascii=False, indent=2, default=str)
        rendered += "\n"
        with _TRACE_LOCK, _TRACE_PATH.open("a", encoding="utf-8") as trace_file:
            trace_file.write(rendered)
    except OSError:
        logger.exception("Could not append interaction trace to %s", _TRACE_PATH)
