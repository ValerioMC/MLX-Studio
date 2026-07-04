"""Inference engine wrapping mlx-lm. Falls back to a streaming echo stub when MLX
is unavailable (non-Apple-Silicon dev machines) so the full app remains testable.

All MLX work (weight loading and generation) runs on one dedicated thread: MLX
GPU streams are thread-local, and FastAPI advances sync response generators from
varying threadpool threads, which intermittently fails with "There is no
Stream(gpu, N) in current thread". Tokens cross over via a queue."""

from __future__ import annotations

import queue
import threading
import time
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

try:  # MLX is only present on Apple Silicon
    from mlx_lm import load, stream_generate  # type: ignore
    from mlx_lm.sample_utils import make_sampler  # type: ignore

    MLX_AVAILABLE = True
except Exception:  # pragma: no cover - exercised on non-mac dev machines
    MLX_AVAILABLE = False


@dataclass
class Runner:
    model_id: str
    local_path: str
    context_length: int
    model: object | None = None
    tokenizer: object | None = None
    enable_thinking: bool = True
    loaded_at: float = field(default_factory=time.time)


# Queue sentinel marking the end of a generation.
_DONE = object()


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

        if not MLX_AVAILABLE:
            yield from self._echo_stream(messages)
            return

        prompt = self._render_prompt(runner, messages)
        tokens: queue.Queue = queue.Queue()
        stop = threading.Event()

        def _produce() -> None:
            try:
                sampler = make_sampler(temp=temperature, top_p=top_p)
                for chunk in stream_generate(
                    runner.model,
                    runner.tokenizer,
                    prompt,
                    max_tokens=max_tokens,
                    sampler=sampler,
                ):
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
