"""Catalog search & detail."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..schemas import CatalogQuery, CatalogSort
from ..security import require_internal_token
from ..services import estimator, hf_catalog, metrics
from ..services.engine import engine

router = APIRouter(prefix="/catalog", tags=["catalog"], dependencies=[Depends(require_internal_token)])


@router.get("/search")
def search(
    q: str = "",
    params_min: float | None = None,
    params_max: float | None = None,
    quant: str | None = None,
    ctx_min: int | None = None,
    vision: bool | None = None,
    instruct: bool | None = None,
    sort: CatalogSort = "downloads",
    limit: int = 30,
):
    query = CatalogQuery(
        q=q,
        params_min=params_min,
        params_max=params_max,
        quant=quant,
        ctx_min=ctx_min,
        vision=vision,
        instruct=instruct,
        sort=sort,
        limit=limit,
    )
    budget = metrics.available_for_models(engine.loaded())
    total_usable = metrics.usable_total()
    out = []
    for r in hf_catalog.search(query):
        ctx = r.get("context_length") or 4096
        est = estimator.estimate_ram(r.get("params_b"), r.get("quantization"), None, ctx)
        dl = estimator.weight_bytes(r.get("params_b"), r.get("quantization"))
        out.append(
            {
                "id": r["hf_repo_id"].split("/")[-1].lower(),
                **r,
                "est_ram_bytes": est,
                "download_bytes": dl,
                "fit": metrics.classify_fit(est, budget, total_usable),
            }
        )
    return {"items": out, "budget_bytes": budget, "total_usable_bytes": total_usable}


@router.get("/detail")
def detail(repo_id: str):
    try:
        return hf_catalog.repo_detail(repo_id)
    except Exception as exc:
        raise HTTPException(502, f"Could not fetch model details: {exc}") from exc
