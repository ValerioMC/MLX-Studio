"""User-editable settings: currently the Hugging Face access token."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..security import require_internal_token
from ..services import settings_store

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(require_internal_token)])


class HfTokenIn(BaseModel):
    token: str | None = None


@router.get("")
def get_settings_view() -> dict:
    # Never return the token itself; only whether one is configured.
    return {"hf_token_set": settings_store.get_hf_token() is not None}


@router.put("/hf-token")
def set_hf_token(body: HfTokenIn) -> dict:
    settings_store.set_hf_token(body.token)
    return {"hf_token_set": settings_store.get_hf_token() is not None}
