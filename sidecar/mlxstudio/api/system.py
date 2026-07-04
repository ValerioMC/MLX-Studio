"""System metrics: one-shot + SSE stream at ~1 Hz."""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from ..db.models import Activity
from ..db.session import get_db
from ..security import require_internal_token
from ..services import metrics
from ..services.engine import engine

router = APIRouter(prefix="/system", tags=["system"], dependencies=[Depends(require_internal_token)])


@router.get("/stats")
def stats():
    return metrics.system_stats(engine.loaded())


@router.get("/stats/stream")
async def stats_stream():
    async def gen():
        while True:
            yield {"event": "stats", "data": json.dumps(metrics.system_stats(engine.loaded()))}
            await asyncio.sleep(1.0)

    return EventSourceResponse(gen())


@router.get("/activity")
def activity(limit: int = 20, db: Session = Depends(get_db)):
    rows = db.scalars(select(Activity).order_by(desc(Activity.created_at)).limit(limit)).all()
    return {
        "items": [
            {"kind": a.kind, "model_id": a.model_id, "message": a.message, "at": a.created_at}
            for a in rows
        ]
    }
