"""Overwrite the local trace with the latest learner chat or exercise submission."""

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
    status: str | None = None,
) -> None:
    """Write only the latest interaction. Trace failures must not interrupt learning flows."""
    record = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "event": event,
        "user_id": user_id,
        "context": context,
        "status": status or ("error" if error else "success"),
        "input": input_data,
        "output": output_data,
        "error": error,
    }

    try:
        rendered = "CODORA INTERACTION TRACE (latest interaction)\n" + "=" * 48 + "\n"
        rendered += json.dumps(record, ensure_ascii=False, indent=2, default=str)
        rendered += "\n"
        with _TRACE_LOCK:
            _TRACE_PATH.write_text(rendered, encoding="utf-8")
    except OSError:
        logger.exception("Could not overwrite interaction trace at %s", _TRACE_PATH)
