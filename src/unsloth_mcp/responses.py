"""Shared response helpers - dialogic returns with auto-logging (SOTA §7.1)."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("unsloth_mcp")


def _error_response(error: str, error_type: str = "general", **kwargs: Any) -> dict:
    """Auto-logging error response - traceback logged before returning to caller."""
    logger.exception("Tool error: %s [%s]", error, error_type)
    out: dict[str, Any] = {
        "success": False,
        "message": f"Failed: {error}",
        "error": error,
        "error_type": error_type,
    }
    out.update(kwargs)
    return out


def ok_response(message: str, data: Any = None, **kwargs: Any) -> dict:
    """Standard success envelope: {success, message, data, ...}."""
    out: dict[str, Any] = {"success": True, "message": message, "data": data}
    out.update(kwargs)
    return out
