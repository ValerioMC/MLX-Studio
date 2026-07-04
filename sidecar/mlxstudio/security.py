"""Auth dependencies. Internal API uses the per-launch bearer token; the
OpenAI-compatible surface uses the user's API key."""

from __future__ import annotations

from fastapi import Header, HTTPException, status

from .config import get_settings

settings = get_settings()


def require_internal_token(authorization: str = Header(default="")) -> None:
    token = authorization.removeprefix("Bearer ").strip()
    if token != settings.token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid internal token")


def require_api_key(authorization: str = Header(default="")) -> None:
    key = authorization.removeprefix("Bearer ").strip()
    if key != settings.api_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid API key")
