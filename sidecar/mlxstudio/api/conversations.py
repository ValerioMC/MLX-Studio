"""Conversation history for the built-in chat UI."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..db.models import Conversation, Message
from ..db.session import get_db
from ..security import require_internal_token

router = APIRouter(
    prefix="/conversations", tags=["conversations"], dependencies=[Depends(require_internal_token)]
)

TITLE_MAX_CHARS = 48


class ConversationIn(BaseModel):
    model_id: str | None = None


class ConversationPatch(BaseModel):
    title: str


class MessageIn(BaseModel):
    role: str
    content: str
    tok_per_sec: float | None = None


class MessagesIn(BaseModel):
    messages: list[MessageIn]


def _conversation_out(c: Conversation) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "model_id": c.model_id,
        "updated_at": c.updated_at,
    }


@router.get("")
def list_conversations(db: Session = Depends(get_db)):
    rows = db.scalars(select(Conversation).order_by(desc(Conversation.updated_at))).all()
    return {"items": [_conversation_out(c) for c in rows]}


@router.post("")
def create_conversation(body: ConversationIn, db: Session = Depends(get_db)):
    conv = Conversation(model_id=body.model_id)
    db.add(conv)
    db.commit()
    return _conversation_out(conv)


@router.get("/{conv_id}/messages")
def get_messages(conv_id: str, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return {
        "items": [
            {"role": m.role, "content": m.content, "tok_per_sec": m.tok_per_sec}
            for m in conv.messages
        ]
    }


@router.post("/{conv_id}/messages")
def append_messages(conv_id: str, body: MessagesIn, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    for m in body.messages:
        db.add(
            Message(
                conversation_id=conv_id,
                role=m.role,
                content=m.content,
                tok_per_sec=m.tok_per_sec,
            )
        )
    if conv.title is None:
        first_user = next((m.content for m in body.messages if m.role == "user"), None)
        if first_user:
            conv.title = first_user.strip()[:TITLE_MAX_CHARS]
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    return _conversation_out(conv)


@router.patch("/{conv_id}")
def rename_conversation(conv_id: str, patch: ConversationPatch, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    conv.title = patch.title.strip()[:TITLE_MAX_CHARS]
    db.commit()
    return _conversation_out(conv)


@router.delete("/{conv_id}")
def delete_conversation(conv_id: str, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conv_id)
    if conv:
        db.delete(conv)
        db.commit()
    return {"ok": True}
