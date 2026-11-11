"""Write the most recent LLM request metadata to a local trace file."""

import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)
_TRACE_PATH = Path(__file__).resolve().parents[2] / "trace.txt"
_TRACE_LOCK = threading.Lock()


def _token_count(usage: Any, name: str) -> int | None:
    if usage is None:
        return None
    value = usage.get(name) if isinstance(usage, dict) else getattr(usage, name, None)
    return value if isinstance(value, int) else None


def write_llm_trace(
    *,
    operation: str,
    model: str,
    instructions: str,
    input_data: Any,
    elapsed_ms: float,
    usage: Any = None,
    error: str | None = None,
) -> None:
    """Overwrite trace.txt with the latest LLM input, usage, and duration."""
    input_tokens = _token_count(usage, "input_tokens")
    output_tokens = _token_count(usage, "output_tokens")
    total_tokens = _token_count(usage, "total_tokens")
    if total_tokens is None and input_tokens is not None and output_tokens is not None:
        total_tokens = input_tokens + output_tokens

    record = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "operation": operation,
        "model": model,
        "processing_time_ms": round(elapsed_ms, 2),
        "tokens": {
            "input": input_tokens,
            "output": output_tokens,
            "total": total_tokens,
        },
        "status": "error" if error else "success",
        "error": error,
        "instructions": instructions,
        "input": input_data,
    }

    try:
        rendered = "CODORA LLM TRACE (latest request)\n" + "=" * 32 + "\n"
        rendered += json.dumps(record, ensure_ascii=False, indent=2, default=str)
        rendered += "\n"
        with _TRACE_LOCK:
            _TRACE_PATH.write_text(rendered, encoding="utf-8")
    except OSError:
        # Diagnostics must never cause an otherwise successful user request to fail.
        logger.exception("Could not write latest LLM trace to %s", _TRACE_PATH)
