"""Pydantic request/response models."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


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
    fits_machine: bool | None = None

    class Config:
        from_attributes = True


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
    kv_cache: bool = True
    # Qwen3 and similar reasoning models emit a long <think> block by default.
    # Set False to skip it and get direct answers.
    enable_thinking: bool = True


class DownloadRequest(BaseModel):
    repo_id: str


class DownloadOut(BaseModel):
    id: str
    hf_repo_id: str
    status: str
    total_bytes: int | None = None
    downloaded_bytes: int = 0
    speed_bps: int | None = None
    error: str | None = None

    class Config:
        from_attributes = True


class SystemStats(BaseModel):
    ram_total: int
    ram_used: int
    ram_available: int
    swap_used: int
    cpu_percent: float
    disk_free: int
    loaded_models: list[dict]


class ConversationIn(BaseModel):
    title: str | None = None
    model_id: str | None = None
    system_prompt: str | None = None


class ConversationPatch(BaseModel):
    title: str | None = None
    pinned: bool | None = None
    system_prompt: str | None = None


class ConversationOut(BaseModel):
    id: str
    title: str | None
    model_id: str | None
    pinned: bool
    updated_at: datetime

    class Config:
        from_attributes = True


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
