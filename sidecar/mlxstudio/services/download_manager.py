"""Resumable model downloads from the Hugging Face Hub.

Progress is published to an asyncio queue per job; routers stream it over SSE.
Files are fetched one by one with huggingface_hub.hf_hub_download (which skips
files already complete on disk), so pause/cancel take effect at the next file
boundary; we sample size on disk to compute speed."""

from __future__ import annotations

import asyncio
import fnmatch
import logging
import shutil
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

from ..config import get_settings

logger = logging.getLogger(__name__)

try:
    from huggingface_hub import HfApi, hf_hub_download

    _hf_api: HfApi | None = HfApi()
except Exception:  # pragma: no cover
    hf_hub_download = None  # type: ignore
    _hf_api = None

settings = get_settings()

# Only the files needed to run a model; keeps downloads lean and the size estimate
# aligned with what actually lands on disk.
ALLOW_PATTERNS = ["*.safetensors", "*.json", "*.txt", "*.model", "tokenizer*", "*.jinja"]


def _repo_files(repo_id: str) -> list[tuple[str, int]]:
    """The (filename, size) pairs we will download, from the Hub metadata."""
    if _hf_api is None:
        return []
    info = _hf_api.model_info(repo_id, files_metadata=True, token=_hf_token())
    return [
        (s.rfilename, getattr(s, "size", None) or 0)
        for s in info.siblings
        if any(fnmatch.fnmatch(s.rfilename, pat) for pat in ALLOW_PATTERNS)
    ]


@dataclass
class Job:
    id: str
    repo_id: str
    status: str = "queued"  # queued|downloading|paused|completed|failed|canceled
    total_bytes: int = 0
    downloaded_bytes: int = 0
    speed_bps: int = 0
    error: str | None = None
    _cancel: threading.Event = field(default_factory=threading.Event)
    _pause: threading.Event = field(default_factory=threading.Event)

    def snapshot(self) -> dict:
        return {
            "id": self.id,
            "hf_repo_id": self.repo_id,
            "status": self.status,
            "total_bytes": self.total_bytes,
            "downloaded_bytes": self.downloaded_bytes,
            "speed_bps": self.speed_bps,
            "error": self.error,
        }


class DownloadManager:
    def __init__(self) -> None:
        self.jobs: dict[str, Job] = {}
        self._listeners: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._complete_handler: Callable[[dict], None] | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def set_complete_handler(self, fn: Callable[[dict], None]) -> None:
        """Register a callback invoked when a job finishes, independent of any SSE
        subscriber. Used to promote a finished download into the model registry."""
        self._complete_handler = fn

    # --- pub/sub for SSE -----------------------------------------------------
    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._listeners.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._listeners.discard(q)

    def _publish(self, job: Job) -> None:
        if self._loop is None:
            return
        payload = job.snapshot()
        for q in list(self._listeners):
            self._loop.call_soon_threadsafe(q.put_nowait, payload)

    # --- control -------------------------------------------------------------
    def start(self, job_id: str, repo_id: str) -> Job:
        job = Job(id=job_id, repo_id=repo_id, status="downloading")
        self.jobs[job_id] = job
        threading.Thread(target=self._run, args=(job,), daemon=True).start()
        return job

    def pause(self, job_id: str) -> None:
        if job := self.jobs.get(job_id):
            job._pause.set()
            job.status = "paused"
            self._publish(job)

    def resume(self, job_id: str) -> None:
        job = self.jobs.get(job_id)
        if job and job.status == "paused":
            job._pause.clear()
            job.status = "downloading"
            threading.Thread(target=self._run, args=(job,), daemon=True).start()

    def cancel(self, job_id: str) -> None:
        """Stop a job, drop its record, and delete partial files on disk."""
        job = self.jobs.pop(job_id, None)
        if job is None:
            return
        job._cancel.set()
        job.status = "canceled"
        self._publish(job)  # let subscribers drop it from their view
        shutil.rmtree(self._target_dir(job.repo_id), ignore_errors=True)

    # --- worker --------------------------------------------------------------
    def _target_dir(self, repo_id: str) -> Path:
        return settings.models_path / repo_id.replace("/", "__")

    def _run(self, job: Job) -> None:
        if hf_hub_download is None:
            job.status = "failed"
            job.error = "huggingface_hub not installed"
            self._publish(job)
            return

        target = self._target_dir(job.repo_id)
        target.mkdir(parents=True, exist_ok=True)

        try:
            files = _repo_files(job.repo_id)
        except Exception as exc:
            job.status = "failed"
            job.error = f"Could not list repository files: {exc}"
            self._publish(job)
            return
        job.total_bytes = sum(size for _, size in files)
        self._publish(job)

        # Fetch file by file in a sub-thread, checking pause/cancel between files
        # (hf_hub_download skips files already complete on disk, so pause/resume
        # and retries never re-download finished shards). The main loop polls
        # disk usage for progress.
        done = threading.Event()
        err: list[Exception] = []

        def _download() -> None:
            attempts = 3
            try:
                for filename, _ in files:
                    if job._cancel.is_set() or job._pause.is_set():
                        return
                    for attempt in range(attempts):
                        try:
                            hf_hub_download(
                                repo_id=job.repo_id,
                                filename=filename,
                                local_dir=str(target),
                                token=_hf_token(),
                            )
                            break
                        except Exception as e:  # noqa: BLE001
                            if attempt == attempts - 1:
                                err[:] = [e]
                                return
                            time.sleep(2 * (attempt + 1))
            finally:
                done.set()

        threading.Thread(target=_download, daemon=True).start()

        last_bytes, last_t = 0, time.time()
        while not done.is_set():
            if job._cancel.is_set():
                job.status = "canceled"
                job.speed_bps = 0
                self._publish(job)
                # The in-flight file may finish writing after cancel() deleted the
                # directory; wait for the worker and sweep the leftovers.
                done.wait()
                shutil.rmtree(target, ignore_errors=True)
                return
            if job._pause.is_set():
                # The worker stops at the next file boundary; reflect the state now.
                job.status = "paused"
                job.speed_bps = 0
                self._publish(job)
                return
            cur = _dir_size(target)
            now = time.time()
            dt = now - last_t
            if dt >= 0.5:
                instant = max(int((cur - last_bytes) / dt), 0)
                # Exponential smoothing: the bursty disk sampling (and the gap
                # while files are hashed/linked) otherwise makes speed flicker.
                job.speed_bps = instant if job.speed_bps == 0 else int(0.6 * job.speed_bps + 0.4 * instant)
                job.downloaded_bytes = cur
                last_bytes, last_t = cur, now
                self._publish(job)
            time.sleep(0.25)

        if err:
            job.status = "failed"
            job.error = str(err[0])
        else:
            job.downloaded_bytes = _dir_size(target)
            if not job.total_bytes:
                job.total_bytes = job.downloaded_bytes
            job.speed_bps = 0
            job.status = "completed"
            # Register the model now, in the worker, so it lands in the registry
            # whether or not a client is streaming progress at this moment.
            if self._complete_handler is not None:
                try:
                    self._complete_handler(job.snapshot())
                except Exception:
                    logger.exception("Download completion handler failed for %s", job.repo_id)
        self._publish(job)


def _dir_size(path: Path) -> int:
    return sum(f.stat().st_size for f in path.rglob("*") if f.is_file())


def _hf_token() -> str | None:
    from .settings_store import get_hf_token

    return get_hf_token()


manager = DownloadManager()
