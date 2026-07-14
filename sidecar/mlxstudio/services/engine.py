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
import queue
import tempfile
import threading
import time
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path

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
            text_messages.append(dict(message))
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
    ) -> Iterator[str]:
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

            if runner.is_vision:
                prompt = vlm_apply_chat_template(
                    runner.processor, runner.config, text_messages, num_images=len(images)
                )
            else:
                prompt = self._render_prompt(runner, text_messages)
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
            try:
                while True:
                    item = tokens.get()
                    if item is _DONE:
                        break
                    if isinstance(item, Exception):
                        raise item
                    yield item
            finally:
                # Client gone or error: tell the producer to stop at the next token.
                stop.set()
        finally:
            # Decoded data-URL images live in temp files; generation has already
            # consumed them by the time the stream ends.
            for path in temp_files:
                Path(path).unlink(missing_ok=True)

    @staticmethod
    def _render_prompt(runner: Runner, messages: list[dict]) -> str:
        """Apply the model's chat template. Some repos ship the template as a
        separate `chat_template.jinja` the tokenizer doesn't auto-load, so fall
        back to reading it from disk before giving up with a clear message."""
        tokenizer = runner.tokenizer
        try:
            return tokenizer.apply_chat_template(  # type: ignore[union-attr]
                messages,
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
