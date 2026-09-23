"""Download jobs + SSE progress stream."""

from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from ..db.models import Activity, Model
from ..db.session import get_db
from ..schemas import DownloadRequest
from ..security import require_internal_token
from ..services.download_manager import manager

router = APIRouter(
    prefix="/downloads", tags=["downloads"], dependencies=[Depends(require_internal_token)]
)


@router.post("")
def create_download(req: DownloadRequest, db: Session = Depends(get_db)):
    """Start a download, or hand back the one already fetching this repo."""
    requested_id = str(uuid.uuid4())
    job = manager.start(requested_id, req.repo_id)
    if job.id == requested_id:
        db.add(Activity(kind="download", message=f"Started download: {req.repo_id}"))
        db.commit()
    return job.snapshot()


@router.get("")
def list_downloads():
    return {"items": [j.snapshot() for j in manager.jobs.values()]}


@router.post("/{job_id}/pause")
def pause(job_id: str):
    manager.pause(job_id)
    return {"ok": True}


@router.post("/{job_id}/resume")
def resume(job_id: str):
    manager.resume(job_id)
    return {"ok": True}


@router.delete("/{job_id}")
def cancel(job_id: str):
    """Cancel an unfinished download, or dismiss a finished one from the list."""
    manager.cancel(job_id)
    return {"ok": True}


@router.get("/stream")
async def stream():
    q = manager.subscribe()

    async def gen():
        try:
            # Emit current state immediately.
            for job in manager.jobs.values():
                yield {"event": "progress", "data": json.dumps(job.snapshot())}
            while True:
                payload = await q.get()
                yield {"event": "progress", "data": json.dumps(payload)}
        except asyncio.CancelledError:
            raise
        finally:
            manager.unsubscribe(q)

    return EventSourceResponse(gen())


def promote_completed_download(payload: dict) -> None:
    """Promote a finished download into the installed models registry.

    Registered as the download manager's completion handler at startup so it runs
    in the download worker, regardless of whether a client is streaming progress."""
    from ..db.session import SessionLocal
    from ..services import hf_catalog

    db = SessionLocal()
    try:
        repo = payload["hf_repo_id"]
        model_id = repo.split("/")[-1].lower()
        existing = db.get(Model, model_id)
        local_path = str((manager._target_dir(repo)))
        meta = hf_catalog.parse_repo_meta(repo)
        if existing is None:
            db.add(
                Model(
                    id=model_id,
                    hf_repo_id=repo,
                    display_name=repo.split("/")[-1].replace("-", " "),
                    local_path=local_path,
                    status="installed",
                    download_bytes=payload.get("total_bytes"),
                    **meta,
                )
            )
        else:
            existing.status = "installed"
            existing.local_path = local_path
        db.add(Activity(kind="download", model_id=model_id, message=f"Downloaded {repo}"))
        db.commit()
    finally:
        db.close()


def reconcile_models() -> None:
    """Register model directories that exist on disk but are missing from the DB.

    Recovers downloads that finished before the registry write existed, or models
    copied into the directory by hand. Runs once at startup."""
    from ..config import get_settings
    from ..db.session import SessionLocal
    from ..services import hf_catalog

    models_dir = get_settings().models_path
    if not models_dir.exists():
        return
    db = SessionLocal()
    try:
        for child in models_dir.iterdir():
            if not child.is_dir() or not (child / "config.json").exists():
                continue
            repo = child.name.replace("__", "/")
            if not hf_catalog.is_chat_model(repo):
                continue
            model_id = repo.split("/")[-1].lower()
            meta = hf_catalog.parse_repo_meta(repo)
            existing = db.get(Model, model_id)
            if existing is not None:
                # Backfill metadata for rows saved before it was captured, so the
                # memory estimate works without re-downloading.
                if existing.params_b is None and meta["params_b"] is not None:
                    existing.params_b = meta["params_b"]
                if existing.quantization is None:
                    existing.quantization = meta["quantization"]
                continue
            size = sum(f.stat().st_size for f in child.rglob("*") if f.is_file())
            db.add(
                Model(
                    id=model_id,
                    hf_repo_id=repo,
                    display_name=repo.split("/")[-1].replace("-", " "),
                    local_path=str(child),
                    status="installed",
                    download_bytes=size,
                    **meta,
                )
            )
            db.add(Activity(kind="download", model_id=model_id, message=f"Recovered {repo}"))
        db.commit()
    finally:
        db.close()
