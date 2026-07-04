"""Persistent user settings (key-value), backed by the app_settings table.

Currently holds the optional Hugging Face token used to raise download rate limits.
The token is read on every download/catalog call so changes apply without a restart.
"""

from __future__ import annotations

import os

from ..db.models import AppSetting
from ..db.session import SessionLocal

_HF_TOKEN_KEY = "hf_token"


def get_setting(key: str) -> str | None:
    db = SessionLocal()
    try:
        row = db.get(AppSetting, key)
        return row.value if row else None
    finally:
        db.close()


def set_setting(key: str, value: str | None) -> None:
    db = SessionLocal()
    try:
        row = db.get(AppSetting, key)
        if row is None:
            db.add(AppSetting(key=key, value=value))
        else:
            row.value = value
        db.commit()
    finally:
        db.close()


def get_hf_token() -> str | None:
    """Stored token wins; fall back to the HF_TOKEN env var for headless/dev use."""
    return get_setting(_HF_TOKEN_KEY) or os.environ.get("HF_TOKEN") or None


def set_hf_token(token: str | None) -> None:
    set_setting(_HF_TOKEN_KEY, (token or "").strip() or None)
