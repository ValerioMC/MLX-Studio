"""Inference engine wrapping mlx-lm (text) and mlx-vlm (vision). Falls back to a
streaming echo stub when MLX is unavailable (non-Apple-Silicon dev machines) so
the full app remains testable.

All MLX work (weight loading and generation) runs on one dedicated thread: MLX
GPU streams are thread-local, and FastAPI advances sync response generators from
varying threadpool threads, which intermittently fails with "There is no
Stream(gpu, N) in current thread". Tokens cross over via a queue."""

from __future__ import annotations

import base64
import binascii
import json
import logging
import queue
import tempfile
import threading
import time
import uuid
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

try:  # MLX is only present on Apple Silicon
    from mlx_lm import load, stream_generate  # type: ignore
    from mlx_lm.sample_utils import make_sampler  # type: ignore

    MLX_AVAILABLE = True
except Exception:  # pragma: no cover - exercised on non-mac dev machines
    MLX_AVAILABLE = False

try:  # Vision models need the separate mlx-vlm package
    from mlx_vlm import load as vlm_load  # type: ignore
    from mlx_vlm import stream_generate as vlm_stream_generate  # type: ignore
    from mlx_vlm.prompt_utils import apply_chat_template as vlm_apply_chat_template  # type: ignore
    from mlx_vlm.utils import load_config as vlm_load_config  # type: ignore

    MLX_VLM_AVAILABLE = True
except Exception:  # pragma: no cover - exercised on non-mac dev machines
    MLX_VLM_AVAILABLE = False


@dataclass
class Runner:
    model_id: str
    local_path: str
    context_length: int
    model: object | None = None
    tokenizer: object | None = None
    # Vision runners carry a processor + config instead of a plain tokenizer.
    is_vision: bool = False
    processor: object | None = None
    config: dict | None = None
    enable_thinking: bool = True
    loaded_at: float = field(default_factory=time.time)


# Queue sentinel marking the end of a generation.
_DONE = object()


@dataclass
class ParsedToolCall:
    """One tool invocation requested by the model, in OpenAI wire shape."""

    id: str
    name: str
    # JSON-encoded arguments string, as the OpenAI API returns them.
    arguments: str


def scan_tool_calls(
    chunks: Iterator[str],
    *,
    start_marker: str,
    end_marker: str | None,
    parser: Callable[[str, list[dict] | None], dict | list[dict]],
    tools: list[dict] | None,
) -> Iterator[str | ParsedToolCall]:
    """Split a generated-text stream into plain text and parsed tool calls.

    Text between start_marker and end_marker (or end of stream, for parsers
    without an end marker, e.g. Mistral) is fed to the model family's parser
    from mlx-lm. Markers can arrive split across chunks, so a tail of
    len(start_marker)-1 characters is withheld until it can't be a marker."""
    buffer = ""
    in_tool = False
    for chunk in chunks:
        buffer += chunk
        while True:
            if not in_tool:
                idx = buffer.find(start_marker)
                if idx == -1:
                    keep = len(start_marker) - 1
                    if len(buffer) > keep:
                        yield buffer[: len(buffer) - keep]
                        buffer = buffer[len(buffer) - keep :]
                    break
                if idx > 0:
                    yield buffer[:idx]
                buffer = buffer[idx + len(start_marker) :]
                in_tool = True
            else:
                if end_marker is None:
                    break
                idx = buffer.find(end_marker)
                if idx == -1:
                    break
                yield from _parse_tool_text(buffer[:idx], parser, tools)
                buffer = buffer[idx + len(end_marker) :]
                in_tool = False
    if in_tool:
        # No end marker (or generation stopped mid-call): parse what we have.
        yield from _parse_tool_text(buffer, parser, tools)
    elif buffer:
        yield buffer


def _parse_tool_text(
    text: str,
    parser: Callable[[str, list[dict] | None], dict | list[dict]],
    tools: list[dict] | None,
) -> Iterator[ParsedToolCall]:
    try:
        parsed = parser(text, tools)
    except (ValueError, json.JSONDecodeError) as exc:
        logger.warning(
            "Failed to parse tool call (%s: %s); tool text was likely truncated",
            type(exc).__name__,
            exc,
        )
        return
    calls = parsed if isinstance(parsed, list) else [parsed]
    for call in calls:
        call_id = call.pop("id", None) or f"call_{uuid.uuid4().hex[:24]}"
        yield ParsedToolCall(
            id=call_id,
            name=call["name"],
            arguments=json.dumps(call.get("arguments") or {}, ensure_ascii=False),
        )


def is_vision_model(local_path: str) -> bool:
    """A repo is a vision model when its config declares a vision tower. Name
    heuristics live in the catalog; here on disk the config is authoritative."""
    config_file = Path(local_path) / "config.json"
    try:
        cfg = json.loads(config_file.read_text())
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return False
    model_type = str(cfg.get("model_type", "")).lower()
    return "vision_config" in cfg or "vision" in model_type or model_type.endswith("_vl")


def normalize_chat_messages(
    messages: list[dict],
) -> tuple[list[dict], list[str], list[str]]:
    """Flatten OpenAI-style content parts into plain-text messages plus images.

    Returns (text_messages, image_refs, temp_files): image_refs are local paths
    or http(s) URLs in message order; data: URLs are decoded into temp files,
    listed in temp_files so the caller can delete them after generation."""
    text_messages: list[dict] = []
    images: list[str] = []
    temp_files: list[str] = []
    for message in messages:
        content = message.get("content")
        if not isinstance(content, list):
            normalized = dict(message)
            # Chat templates do string ops on content; assistant messages that
            # carry only tool_calls come in with content=None.
            if normalized.get("content") is None:
                normalized["content"] = ""
            # OpenAI clients send tool-call arguments as a JSON string; chat
            # templates expect them as a mapping (they re-serialize via tojson).
            if normalized.get("tool_calls"):
                normalized["tool_calls"] = [
                    _tool_call_with_parsed_arguments(tc) for tc in normalized["tool_calls"]
                ]
            text_messages.append(normalized)
            continue
        texts: list[str] = []
        for part in content:
            kind = part.get("type")
            if kind == "text":
                texts.append(part.get("text") or "")
            elif kind == "image_url":
                url = ((part.get("image_url") or {}).get("url") or "").strip()
                if not url:
                    continue
                if url.startswith("data:"):
                    path = _decode_data_url(url)
                    images.append(path)
                    temp_files.append(path)
                else:
                    images.append(url)
        text_messages.append({**message, "content": "\n".join(t for t in texts if t)})
    return text_messages, images, temp_files


def _tool_call_with_parsed_arguments(tool_call: dict) -> dict:
    function = tool_call.get("function")
    if not isinstance(function, dict) or not isinstance(function.get("arguments"), str):
        return tool_call
    try:
        arguments = json.loads(function["arguments"])
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"tool_calls[].function.arguments is not valid JSON: {function['arguments']!r}"
        ) from exc
    return {**tool_call, "function": {**function, "arguments": arguments}}


def _decode_data_url(url: str) -> str:
    """Write a data: URL to a temp file and return its path."""
    header, _, payload = url.partition(",")
    if ";base64" not in header:
        raise RuntimeError("Only base64 data URLs are supported for images.")
    suffix = {
        "data:image/jpeg": ".jpg",
        "data:image/png": ".png",
        "data:image/webp": ".webp",
        "data:image/gif": ".gif",
    }.get(header.split(";")[0], ".png")
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise RuntimeError("Invalid base64 image data.") from exc
    with tempfile.NamedTemporaryFile(prefix="mlxstudio-img-", suffix=suffix, delete=False) as f:
        f.write(raw)
        return f.name


class Engine:
    """Holds loaded model runners in unified memory. One resident model by default."""

    def __init__(self) -> None:
        self._runners: dict[str, Runner] = {}
        self._lock = threading.Lock()
        # Single thread for every MLX call; also serializes concurrent
        # generations, which the GPU would serialize anyway.
        self._mlx_thread = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mlx")

    # --- lifecycle -----------------------------------------------------------
    def load_model(
        self,
        model_id: str,
        local_path: str,
        context_length: int = 4096,
        enable_thinking: bool = True,
    ) -> Runner:
        with self._lock:
            if model_id in self._runners:
                return self._runners[model_id]
            runner = Runner(model_id, local_path, context_length, enable_thinking=enable_thinking)
            if MLX_AVAILABLE:
                if is_vision_model(local_path):
                    if not MLX_VLM_AVAILABLE:
                        raise RuntimeError(
                            "This is a vision model, but mlx-vlm is not installed."
                        )
                    runner.is_vision = True
                    runner.model, runner.processor = self._mlx_thread.submit(
                        vlm_load, local_path
                    ).result()
                    runner.config = vlm_load_config(local_path)
                else:
                    runner.model, runner.tokenizer = self._mlx_thread.submit(
                        load, local_path
                    ).result()
            self._runners[model_id] = runner
            return runner

    def unload_model(self, model_id: str) -> bool:
        with self._lock:
            runner = self._runners.pop(model_id, None)
        if runner is None:
            return False
        runner.model = None
        runner.tokenizer = None
        runner.processor = None
        runner.config = None
        return True

    def is_loaded(self, model_id: str) -> bool:
        return model_id in self._runners

    def supports_tools(self, model_id: str) -> bool:
        """True when the loaded model's chat template has a tool-call format
        mlx-lm can parse. Vision models and the non-MLX stub never qualify."""
        runner = self._runners.get(model_id)
        if runner is None or runner.is_vision:
            return False
        return bool(getattr(runner.tokenizer, "has_tool_calling", False))

    def loaded(self) -> list[dict]:
        return [
            {"model_id": r.model_id, "context_length": r.context_length, "loaded_at": r.loaded_at}
            for r in self._runners.values()
        ]

    # --- inference -----------------------------------------------------------
    def stream_chat(
        self,
        model_id: str,
        messages: list[dict],
        *,
        temperature: float = 0.7,
        top_p: float = 1.0,
        max_tokens: int = 1024,
        tools: list[dict] | None = None,
    ) -> Iterator[str | ParsedToolCall]:
        runner = self._runners.get(model_id)
        if runner is None:
            raise RuntimeError(f"Model '{model_id}' is not running.")

        text_messages, images, temp_files = normalize_chat_messages(messages)
        try:
            if not MLX_AVAILABLE:
                yield from self._echo_stream(text_messages)
                return
            if images and not runner.is_vision:
                raise RuntimeError(
                    f"Model '{model_id}' is text-only and can't read images. "
                    "Start a vision model to send images."
                )
            if tools and runner.is_vision:
                raise RuntimeError(
                    f"Model '{model_id}' is a vision model; tool calling is only "
                    "supported for text models."
                )
            if tools and not getattr(runner.tokenizer, "has_tool_calling", False):
                raise RuntimeError(
                    f"Model '{model_id}' does not support tool calling: its chat "
                    "template has no tool-call format mlx-lm can parse."
                )

            if runner.is_vision:
                prompt = vlm_apply_chat_template(
                    runner.processor, runner.config, text_messages, num_images=len(images)
                )
            else:
                prompt = self._render_prompt(runner, text_messages, tools)
            tokens: queue.Queue = queue.Queue()
            stop = threading.Event()

            def _produce() -> None:
                try:
                    if runner.is_vision:
                        chunks = vlm_stream_generate(
                            runner.model,
                            runner.processor,
                            prompt,
                            image=images or None,
                            max_tokens=max_tokens,
                            temperature=temperature,
                            top_p=top_p,
                        )
                    else:
                        sampler = make_sampler(temp=temperature, top_p=top_p)
                        chunks = stream_generate(
                            runner.model,
                            runner.tokenizer,
                            prompt,
                            max_tokens=max_tokens,
                            sampler=sampler,
                        )
                    for chunk in chunks:
                        if stop.is_set():
                            break
                        tokens.put(getattr(chunk, "text", str(chunk)))
                except Exception as exc:  # noqa: BLE001 - surfaced to the consumer
                    tokens.put(exc)
                finally:
                    tokens.put(_DONE)

            self._mlx_thread.submit(_produce)

            def _drain() -> Iterator[str]:
                while True:
                    item = tokens.get()
                    if item is _DONE:
                        break
                    if isinstance(item, Exception):
                        raise item
                    yield item

            try:
                if tools:
                    yield from scan_tool_calls(
                        _drain(),
                        start_marker=runner.tokenizer.tool_call_start,  # type: ignore[union-attr]
                        end_marker=runner.tokenizer.tool_call_end,  # type: ignore[union-attr]
                        parser=runner.tokenizer.tool_parser,  # type: ignore[union-attr]
                        tools=tools,
                    )
                else:
                    yield from _drain()
            finally:
                # Client gone or error: tell the producer to stop at the next token.
                stop.set()
        finally:
            # Decoded data-URL images live in temp files; generation has already
            # consumed them by the time the stream ends.
            for path in temp_files:
                Path(path).unlink(missing_ok=True)

    @staticmethod
    def _render_prompt(
        runner: Runner, messages: list[dict], tools: list[dict] | None = None
    ) -> str:
        """Apply the model's chat template. Some repos ship the template as a
        separate `chat_template.jinja` the tokenizer doesn't auto-load, so fall
        back to reading it from disk before giving up with a clear message."""
        tokenizer = runner.tokenizer
        try:
            return tokenizer.apply_chat_template(  # type: ignore[union-attr]
                messages,
                tools=tools,
                add_generation_prompt=True,
                tokenize=False,
                enable_thinking=runner.enable_thinking,
            )
        except Exception:
            from pathlib import Path

            template_file = Path(runner.local_path) / "chat_template.jinja"
            if template_file.exists():
                return tokenizer.apply_chat_template(  # type: ignore[union-attr]
                    messages,
                    tools=tools,
                    add_generation_prompt=True,
                    tokenize=False,
                    enable_thinking=runner.enable_thinking,
                    chat_template=template_file.read_text(),
                )
            raise RuntimeError(
                "This model has no chat template, so it can't be used for chat."
            )

    @staticmethod
    def _echo_stream(messages: list[dict]) -> Iterator[str]:
        last = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
        reply = (
            "[stub engine — MLX not available on this machine] "
            f"You said: {last}. On Apple Silicon this streams real tokens via mlx-lm."
        )
        for word in reply.split(" "):
            yield word + " "
            time.sleep(0.02)


engine = Engine()
