"""OpenAI-compatible API. Drop-in for the OpenAI SDK: point base_url here.

Serves both the built-in chat UI and external clients (Continue, Cursor, curl)."""

from __future__ import annotations

import json
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from ..config import get_settings
from ..db.session import SessionLocal
from ..schemas import ChatCompletionRequest
from ..security import require_api_key
from ..services.engine import engine

router = APIRouter(prefix="/v1", tags=["openai"], dependencies=[Depends(require_api_key)])
settings = get_settings()


@router.get("/models")
def list_models():
    data = [
        {"id": r["model_id"], "object": "model", "owned_by": "mlx-studio"}
        for r in engine.loaded()
    ]
    return {"object": "list", "data": data}


def _ensure_loaded(model_id: str) -> None:
    if engine.is_loaded(model_id):
        return
    if not settings.autoload_on_request:
        raise HTTPException(
            status_code=409,
            detail={"type": "model_not_loaded", "message": f"Model '{model_id}' is not running."},
        )
    db = SessionLocal()
    try:
        from ..db.models import Model

        m = db.get(Model, model_id)
        if not m or not m.local_path:
            raise HTTPException(404, f"Model '{model_id}' not installed.")
        engine.load_model(model_id, m.local_path, m.context_length or 4096)
    finally:
        db.close()


@router.post("/chat/completions")
def chat_completions(req: ChatCompletionRequest):
    _ensure_loaded(req.model)
    messages = [m.model_dump() for m in req.messages]
    cid = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created = int(time.time())

    if req.stream:
        def event_stream():
            t0 = time.time()
            n = 0
            try:
                for token in engine.stream_chat(
                    req.model,
                    messages,
                    temperature=req.temperature,
                    top_p=req.top_p,
                    max_tokens=req.max_tokens,
                ):
                    n += 1
                    chunk = {
                        "id": cid,
                        "object": "chat.completion.chunk",
                        "created": created,
                        "model": req.model,
                        "choices": [
                            {"index": 0, "delta": {"content": token}, "finish_reason": None}
                        ],
                    }
                    yield f"data: {json.dumps(chunk)}\n\n"
            except Exception as exc:  # surface generation errors to the client
                err = {
                    "id": cid,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": req.model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": f"\n\n[error] {exc}"},
                            "finish_reason": "error",
                        }
                    ],
                }
                yield f"data: {json.dumps(err)}\n\n"
                yield "data: [DONE]\n\n"
                return
            done = {
                "id": cid,
                "object": "chat.completion.chunk",
                "created": created,
                "model": req.model,
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                "usage": {"completion_tokens": n, "tok_per_sec": n / max(time.time() - t0, 1e-6)},
            }
            yield f"data: {json.dumps(done)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    # Non-streaming
    text = "".join(
        engine.stream_chat(
            req.model,
            messages,
            temperature=req.temperature,
            top_p=req.top_p,
            max_tokens=req.max_tokens,
        )
    )
    return {
        "id": cid,
        "object": "chat.completion",
        "created": created,
        "model": req.model,
        "choices": [
            {"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}
        ],
    }
