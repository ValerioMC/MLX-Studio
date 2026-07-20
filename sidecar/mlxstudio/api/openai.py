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
from ..services.engine import ParsedToolCall, engine

router = APIRouter(prefix="/v1", tags=["openai"], dependencies=[Depends(require_api_key)])
settings = get_settings()


@router.get("/models")
def list_models():
    """Every installed chat model is served: requests to a stopped one trigger an
    autoload, so clients should see the full registry, not just what's loaded."""
    from ..services import hf_catalog

    db = SessionLocal()
    try:
        from ..db.models import Model

        rows = db.query(Model).filter(Model.local_path.isnot(None)).all()
        data = [
            {"id": m.id, "object": "model", "owned_by": "mlx-studio"}
            for m in rows
            if hf_catalog.is_chat_model(m.hf_repo_id)
        ]
    finally:
        db.close()
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


def _requested_tools(req: ChatCompletionRequest) -> list[dict] | None:
    if not req.tools or req.tool_choice == "none":
        return None
    return [t.model_dump(exclude_none=True) for t in req.tools]


def _wire_tool_call(call: ParsedToolCall, index: int | None = None) -> dict:
    wire = {
        "id": call.id,
        "type": "function",
        "function": {"name": call.name, "arguments": call.arguments},
    }
    if index is not None:
        wire = {"index": index, **wire}
    return wire


@router.post("/chat/completions")
def chat_completions(req: ChatCompletionRequest):
    _ensure_loaded(req.model)
    messages = [m.model_dump(exclude_none=True) for m in req.messages]
    tools = _requested_tools(req)
    if tools and not engine.supports_tools(req.model):
        raise HTTPException(
            status_code=400,
            detail={
                "type": "tools_not_supported",
                "message": f"Model '{req.model}' does not support tool calling.",
            },
        )
    cid = f"chatcmpl-{uuid.uuid4().hex[:24]}"
    created = int(time.time())

    if req.stream:
        def event_stream():
            t0 = time.time()
            n = 0
            tool_call_count = 0

            def chunk_payload(delta: dict) -> str:
                chunk = {
                    "id": cid,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": req.model,
                    "choices": [{"index": 0, "delta": delta, "finish_reason": None}],
                }
                return f"data: {json.dumps(chunk)}\n\n"

            try:
                for event in engine.stream_chat(
                    req.model,
                    messages,
                    temperature=req.temperature,
                    top_p=req.top_p,
                    max_tokens=req.max_tokens,
                    tools=tools,
                ):
                    n += 1
                    if isinstance(event, ParsedToolCall):
                        delta = {"tool_calls": [_wire_tool_call(event, tool_call_count)]}
                        tool_call_count += 1
                    else:
                        delta = {"content": event}
                    yield chunk_payload(delta)
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
                "choices": [
                    {
                        "index": 0,
                        "delta": {},
                        "finish_reason": "tool_calls" if tool_call_count else "stop",
                    }
                ],
                "usage": {"completion_tokens": n, "tok_per_sec": n / max(time.time() - t0, 1e-6)},
            }
            yield f"data: {json.dumps(done)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream")

    # Non-streaming
    text_parts: list[str] = []
    tool_calls: list[dict] = []
    try:
        for event in engine.stream_chat(
            req.model,
            messages,
            temperature=req.temperature,
            top_p=req.top_p,
            max_tokens=req.max_tokens,
            tools=tools,
        ):
            if isinstance(event, ParsedToolCall):
                tool_calls.append(_wire_tool_call(event))
            else:
                text_parts.append(event)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    text = "".join(text_parts)
    message: dict = {"role": "assistant", "content": text or (None if tool_calls else "")}
    if tool_calls:
        message["tool_calls"] = tool_calls
    return {
        "id": cid,
        "object": "chat.completion",
        "created": created,
        "model": req.model,
        "choices": [
            {
                "index": 0,
                "message": message,
                "finish_reason": "tool_calls" if tool_calls else "stop",
            }
        ],
    }
