"""Business hours enforcement helpers.

The `business_hours` column on WidgetConfig is stored as a string. We support
two shapes for backwards compatibility:

1) Plain free-form text (legacy) — used only inside the system prompt. In this
   case we cannot enforce hours programmatically, so `is_open()` returns True.

2) JSON string of the form:
   {
     "timezone": "America/New_York",
     "days": {
       "mon": {"open": "09:00", "close": "17:00"},
       "tue": {"open": "09:00", "close": "17:00"},
       ...
     },
     "closed_message": "We're closed!"
   }
   A missing day, or a day with an empty/None open/close, means "closed".
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, time
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger(__name__)

DEFAULT_CLOSED_MESSAGE = (
    "Thanks for reaching out! We're currently outside our business hours. "
    "An agent will get back to you as soon as we're back."
)

_DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _parse_business_hours(widget_config: Any) -> dict | None:
    """Return parsed business_hours dict, or None if missing/invalid/legacy text."""
    if not widget_config:
        return None
    raw = getattr(widget_config, "business_hours", None)
    if not raw:
        return None
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict) and "days" in parsed:
            return parsed
    except (ValueError, TypeError):
        return None
    return None


def _parse_time(value: str | None) -> time | None:
    if not value or not isinstance(value, str):
        return None
    try:
        hh, mm = value.split(":")
        return time(int(hh), int(mm))
    except (ValueError, AttributeError):
        return None


def is_open(widget_config: Any) -> bool:
    """Return True if business hours allow service right now.

    If enforcement is disabled, business_hours is unset, or the JSON shape is
    not recognized, we treat the business as always open.
    """
    if not widget_config:
        return True
    if not getattr(widget_config, "enforce_business_hours", False):
        return True

    cfg = _parse_business_hours(widget_config)
    if not cfg:
        return True  # legacy text or no config — cannot enforce

    tz_name = cfg.get("timezone") or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("UTC")

    now = datetime.now(tz)
    day_key = _DAY_KEYS[now.weekday()]
    day_cfg = (cfg.get("days") or {}).get(day_key)
    if not day_cfg:
        return False

    open_t = _parse_time(day_cfg.get("open"))
    close_t = _parse_time(day_cfg.get("close"))
    if open_t is None or close_t is None:
        return False

    now_t = now.time()
    if close_t <= open_t:
        # Overnight window (e.g. 22:00 → 02:00)
        return now_t >= open_t or now_t < close_t
    return open_t <= now_t < close_t


def get_closed_message(widget_config: Any) -> str:
    """Return the configured closed message, falling back to a sensible default."""
    cfg = _parse_business_hours(widget_config)
    if cfg:
        msg = cfg.get("closed_message")
        if isinstance(msg, str) and msg.strip():
            return msg
    return DEFAULT_CLOSED_MESSAGE
