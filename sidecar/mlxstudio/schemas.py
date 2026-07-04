"""Pydantic request/response models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ModelOut(BaseModel):
    id: str
    hf_repo_id: str
    display_name: str
    params_b: float | None = None
    quantization: str | None = None
    context_length: int | None = None
    vision: bool = False
    instruct: bool = False
    download_bytes: int | None = None
    est_ram_bytes: int | None = None
    license: str | None = None
    description: str | None = None
    status: str = "available"
    # False for repos the chat engine can't serve (ASR, embeddings, ...).
    chat_capable: bool = True

    model_config = ConfigDict(from_attributes=True)


class CatalogQuery(BaseModel):
    q: str = ""
    params_min: float | None = None
    params_max: float | None = None
    quant: str | None = None
    ctx_min: int | None = None
    vision: bool | None = None
    instruct: bool | None = None
    sort: str = "downloads"
    limit: int = 30


class StartModelRequest(BaseModel):
    context_length: int | None = None
    # Qwen3 and similar reasoning models emit a long <think> block by default.
    # Set False to skip it and get direct answers.
    enable_thinking: bool = True


class DownloadRequest(BaseModel):
    repo_id: str


# --- OpenAI-compatible ---
class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    temperature: float = 0.7
    top_p: float = 1.0
    max_tokens: int = 1024
    stream: bool = False
    stop: list[str] | None = None
