"""Installed model registry + lifecycle (start/stop/delete/update/logs)."""

from __future__ import annotations

import logging
import shutil
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Activity, Model
from ..db.session import get_db
from ..schemas import ModelOut, StartModelRequest
from ..security import require_internal_token
from ..services import estimator, hf_catalog, metrics, model_log
from ..services.engine import engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/models", tags=["models"], dependencies=[Depends(require_internal_token)])


def _model_out(m: Model) -> ModelOut:
    item = ModelOut.model_validate(m)
    item.status = "running" if engine.is_loaded(m.id) else m.status
    item.chat_capable = hf_catalog.is_chat_model(m.hf_repo_id)
    return item


@router.get("", response_model=list[ModelOut])
def list_models(db: Session = Depends(get_db)):
    return [_model_out(m) for m in db.scalars(select(Model)).all()]


@router.get("/{model_id}", response_model=ModelOut)
def get_model(model_id: str, db: Session = Depends(get_db)):
    m = db.get(Model, model_id)
    if not m:
        raise HTTPException(404, "Model not found")
    return _model_out(m)


@router.get("/{model_id}/estimate")
def estimate_memory(model_id: str, context_length: int = 4096, db: Session = Depends(get_db)):
    """Estimate RAM for loading this model at a given context length, broken down
    into weights, KV cache (the part that grows with context), and overhead."""
    m = db.get(Model, model_id)
    if not m or not m.local_path:
        raise HTTPException(404, "Model not installed")

    # Fall back to params/quant parsed from the repo name when the DB row lacks
    # them (downloads stored before metadata was captured).
    meta = hf_catalog.parse_repo_meta(m.hf_repo_id)
    params_b = m.params_b if m.params_b is not None else meta["params_b"]
    quant = m.quantization or meta["quantization"]
    budget = metrics.available_for_models(engine.loaded())
    total_usable = metrics.usable_total()

    breakdown = estimator.installed_breakdown(m.local_path, params_b, quant, context_length)
    if breakdown is None:
        config = estimator.read_config(m.local_path)
        return {
            "context_length": context_length,
            "est_ram_bytes": None,
            "fit": "unknown",
            "budget_bytes": budget,
            "total_usable_bytes": total_usable,
            "max_context": (config or {}).get("max_position_embeddings"),
        }

    return {
        "context_length": context_length,
        **breakdown,
        "fit": metrics.classify_fit(breakdown["est_ram_bytes"], budget, total_usable),
        "budget_bytes": budget,
        "total_usable_bytes": total_usable,
    }


@router.post("/{model_id}/start")
def start_model(model_id: str, req: StartModelRequest, db: Session = Depends(get_db)):
    m = db.get(Model, model_id)
    if not m or not m.local_path:
        raise HTTPException(404, "Model not installed")
    if not hf_catalog.is_chat_model(m.hf_repo_id):
        raise HTTPException(
            422,
            detail={
                "type": "not_chat_capable",
                "message": f"'{m.display_name}' is not a chat model, so it cannot be started.",
            },
        )

    ctx = req.context_length or m.context_length or 4096
    # Block only what can never fit: macOS reclaims inactive pages and file
    # cache under pressure, so "free right now" is not the real ceiling. The UI
    # surfaces the tight-fit case as a warning instead.
    breakdown = estimator.installed_breakdown(m.local_path, m.params_b, m.quantization, ctx)
    total_usable = metrics.usable_total()
    if breakdown is not None and breakdown["est_ram_bytes"] > total_usable:
        raise HTTPException(
            409,
            detail={
                "type": "insufficient_memory",
                "message": (
                    "This model does not fit this machine: it needs "
                    f"~{breakdown['est_ram_bytes'] / 1e9:.0f} GB but at most "
                    f"~{total_usable / 1e9:.0f} GB of memory can be freed."
                ),
                "detail": {"required": breakdown["est_ram_bytes"], "usable": total_usable},
            },
        )

    try:
        engine.load_model(model_id, m.local_path, ctx, enable_thinking=req.enable_thinking)
    except Exception as exc:
        logger.exception("Failed to load model %s", model_id)
        raise HTTPException(
            422,
            detail={
                "type": "load_failed",
                "message": (
                    f"Could not load '{m.display_name}'. It may not be a text-generation "
                    f"model (only chat/instruct LLMs are supported). Details: {exc}"
                ),
            },
        ) from exc
    m.last_used_at = datetime.now(timezone.utc)
    db.add(Activity(kind="start", model_id=model_id, message=f"Started {m.display_name}"))
    db.commit()
    return {"status": "running", "model_id": model_id, "context_length": ctx}


@router.post("/{model_id}/stop")
def stop_model(model_id: str, db: Session = Depends(get_db)):
    ok = engine.unload_model(model_id)
    if ok:
        m = db.get(Model, model_id)
        name = m.display_name if m else model_id
        db.add(Activity(kind="stop", model_id=model_id, message=f"Stopped {name}"))
        db.commit()
    return {"status": "installed", "model_id": model_id, "was_running": ok}


@router.delete("/{model_id}")
def delete_model(model_id: str, db: Session = Depends(get_db)):
    m = db.get(Model, model_id)
    if not m:
        raise HTTPException(404, "Model not found")
    engine.unload_model(model_id)
    if m.local_path:
        shutil.rmtree(m.local_path, ignore_errors=True)
    db.add(Activity(kind="delete", model_id=model_id, message=f"Deleted {m.display_name}"))
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.post("/{model_id}/update")
def update_model(model_id: str, db: Session = Depends(get_db)):
    m = db.get(Model, model_id)
    if not m:
        raise HTTPException(404, "Model not found")
    from ..services.download_manager import manager

    # The update writes into the installed model's directory, so canceling it
    # must keep the weights that are already there.
    job = manager.start(f"update-{model_id}", m.hf_repo_id, keep_files_on_cancel=True)
    return {"ok": True, "job_id": job.id}


@router.get("/{model_id}/logs")
def logs(model_id: str, tail: int = 200):
    """The last lines of the model's diagnostic log (see services/model_log.py)."""
    return {"lines": model_log.tail(model_id, max(1, min(tail, 2000)))}
