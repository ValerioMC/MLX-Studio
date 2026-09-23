"""Pydantic request/response models."""

from __future__ import annotations

from typing import Literal

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


CatalogSort = Literal["downloads", "likes", "recent"]


class CatalogQuery(BaseModel):
    q: str = ""
    params_min: float | None = None
    params_max: float | None = None
    quant: str | None = None
    ctx_min: int | None = None
    vision: bool | None = None
    instruct: bool | None = None
    sort: CatalogSort = "downloads"
    limit: int = 30


class StartModelRequest(BaseModel):
    context_length: int | None = None
    # Qwen3 and similar reasoning models emit a long <think> block by default.
    # Set False to skip it and get direct answers.
    enable_thinking: bool = True


class DownloadRequest(BaseModel):
    repo_id: str


# --- OpenAI-compatible ---
class TextPart(BaseModel):
    type: Literal["text"]
    text: str


class ImageUrl(BaseModel):
    # Either an http(s) URL or a base64 data: URL, as in the OpenAI API.
    url: str


class ImagePart(BaseModel):
    type: Literal["image_url"]
    image_url: ImageUrl


class ToolFunctionDef(BaseModel):
    name: str
    description: str | None = None
    # JSON Schema for the function arguments, as in the OpenAI API.
    parameters: dict | None = None


class ToolDef(BaseModel):
    type: Literal["function"]
    function: ToolFunctionDef


class ToolCallFunction(BaseModel):
    name: str
    # JSON-encoded arguments string, as in the OpenAI API.
    arguments: str


class ToolCall(BaseModel):
    id: str
    type: Literal["function"] = "function"
    function: ToolCallFunction


class ChatMessage(BaseModel):
    role: str
    # Plain text, OpenAI-style content parts for multimodal (vision) input,
    # or None for assistant messages that carry only tool_calls.
    content: str | list[TextPart | ImagePart] | None = None
    # Set on assistant messages that requested tool invocations.
    tool_calls: list[ToolCall] | None = None
    # Set on role="tool" messages carrying a tool result.
    tool_call_id: str | None = None


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    temperature: float = 0.7
    top_p: float = 1.0
    max_tokens: int = 1024
    stream: bool = False
    stop: list[str] | None = None
    tools: list[ToolDef] | None = None
    # "auto" | "none" | "required" | {"type": "function", "function": {...}}.
    # Only "none" changes behavior (tools are dropped); local models can't be
    # forced into a specific call, so the other values behave like "auto".
    tool_choice: str | dict | None = None
