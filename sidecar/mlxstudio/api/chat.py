"""Conversation persistence for the built-in chat UI."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..db.models import Conversation, Message
from ..db.session import get_db
from ..schemas import ConversationIn, ConversationOut, ConversationPatch
from ..security import require_internal_token

router = APIRouter(
    prefix="/conversations", tags=["chat"], dependencies=[Depends(require_internal_token)]
)


@router.get("", response_model=list[ConversationOut])
def list_conversations(db: Session = Depends(get_db)):
    return db.scalars(
        select(Conversation).order_by(desc(Conversation.pinned), desc(Conversation.updated_at))
    ).all()


@router.post("", response_model=ConversationOut)
def create_conversation(body: ConversationIn, db: Session = Depends(get_db)):
    conv = Conversation(
        title=body.title or "New Chat",
        model_id=body.model_id,
        system_prompt=body.system_prompt,
    )
    db.add(conv)
    db.commit()
    return conv


@router.get("/{conv_id}/messages")
def get_messages(conv_id: str, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return {
        "items": [
            {"id": m.id, "role": m.role, "content": m.content, "tok_per_sec": m.tok_per_sec}
            for m in conv.messages
        ]
    }


@router.patch("/{conv_id}", response_model=ConversationOut)
def patch_conversation(conv_id: str, patch: ConversationPatch, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conv_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if patch.title is not None:
        conv.title = patch.title
    if patch.pinned is not None:
        conv.pinned = patch.pinned
    if patch.system_prompt is not None:
        conv.system_prompt = patch.system_prompt
    db.commit()
    return conv


@router.delete("/{conv_id}")
def delete_conversation(conv_id: str, db: Session = Depends(get_db)):
    conv = db.get(Conversation, conv_id)
    if conv:
        db.delete(conv)
        db.commit()
    return {"ok": True}


def persist_exchange(
    db: Session, conv_id: str, user_text: str, assistant_text: str, tok_per_sec: float | None
) -> None:
    db.add(Message(conversation_id=conv_id, role="user", content=user_text))
    db.add(
        Message(
            conversation_id=conv_id,
            role="assistant",
            content=assistant_text,
            tok_per_sec=tok_per_sec,
        )
    )
    conv = db.get(Conversation, conv_id)
    if conv and conv.title in (None, "New Chat"):
        conv.title = user_text[:48]
    db.commit()
