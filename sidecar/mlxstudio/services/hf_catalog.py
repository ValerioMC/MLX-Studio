"""Discover MLX-compatible models on the Hugging Face Hub.

The mlx-community org hosts thousands of pre-converted MLX models; we query it and
normalize results. Falls back to a small seeded list if the Hub is unreachable."""

from __future__ import annotations

import logging
import re

from ..schemas import CatalogQuery

logger = logging.getLogger(__name__)

try:
    from huggingface_hub import HfApi

    _api: HfApi | None = HfApi()
except Exception:  # pragma: no cover
    _api = None

# "7B", "0.6B", but not the "4b" in "4bit" nor the active-expert "A3B" of an MoE.
_PARAM_RE = re.compile(r"(?<![a-zA-Z\d.])(\d+(?:\.\d+)?)\s*[bB](?![a-zA-Z])")
_QUANT_RE = re.compile(r"(\d+)bit|bf16|fp16|fp32|mxfp4|nvfp4", re.IGNORECASE)
# "Instruct", "chat", or gemma's "-it" suffix; never the "it" ending "4bit".
_INSTRUCT_RE = re.compile(r"instruct|chat|(?:^|[-_])it(?:$|[-_])", re.IGNORECASE)

# Model families mlx-community hosts that are not text-generation LLMs, so the chat
# engine (mlx_lm) cannot load them. Excluded from the catalog to avoid downloading
# something that can't be started.
_NON_LLM_RE = re.compile(
    r"whisper|parakeet|wav2vec|encodec|musicgen|bark|"
    r"embed|bert|minilm|rerank|gte-|bge-|clip|siglip|\basr\b|"
    r"stable-?diffusion|\bsd-|flux|sana|"
    r"\btts\b|vits|kokoro",
    re.IGNORECASE,
)

_SEED = [
    {
        "hf_repo_id": "mlx-community/Qwen2.5-7B-Instruct-4bit",
        "display_name": "Qwen2.5 7B Instruct (4-bit)",
        "params_b": 7.0,
        "quantization": "4bit",
        "context_length": 32768,
        "vision": False,
        "instruct": True,
        "description": "Strong general-purpose instruct model, 4-bit MLX conversion.",
        "downloads_30d": 50000,
    },
    {
        "hf_repo_id": "mlx-community/Llama-3.2-3B-Instruct-4bit",
        "display_name": "Llama 3.2 3B Instruct (4-bit)",
        "params_b": 3.0,
        "quantization": "4bit",
        "context_length": 131072,
        "vision": False,
        "instruct": True,
        "description": "Compact, fast model that fits comfortably in 8 GB.",
        "downloads_30d": 42000,
    },
    {
        "hf_repo_id": "mlx-community/Qwen2-VL-7B-Instruct-4bit",
        "display_name": "Qwen2-VL 7B Instruct (4-bit)",
        "params_b": 7.0,
        "quantization": "4bit",
        "context_length": 32768,
        "vision": True,
        "instruct": True,
        "description": "Vision-language model for image + text chat.",
        "downloads_30d": 18000,
    },
]


def parse_repo_meta(repo_id: str) -> dict:
    """Infer params/quant/vision/instruct from a repo name."""
    name = repo_id.split("/")[-1]
    pm = _PARAM_RE.search(name)
    qm = _QUANT_RE.search(name)
    return {
        "params_b": float(pm.group(1)) if pm else None,
        "quantization": (qm.group(0).lower() if qm else None),
        "vision": bool(re.search(r"vl|vision|llava", name, re.IGNORECASE)),
        "instruct": bool(_INSTRUCT_RE.search(name)),
    }


def is_chat_model(repo_id: str) -> bool:
    """False for ASR/embedding/TTS/diffusion repos the chat engine can't load."""
    return _NON_LLM_RE.search(repo_id) is None


def repo_detail(repo_id: str) -> dict:
    """License, popularity, and README for one repo, straight from the Hub."""
    if _api is None:
        raise RuntimeError("Hugging Face Hub is unreachable")
    from .settings_store import get_hf_token

    token = get_hf_token()
    info = _api.model_info(repo_id, token=token)
    card_data = getattr(info, "card_data", None)
    readme: str | None = None
    try:
        from huggingface_hub import ModelCard

        readme = ModelCard.load(repo_id, token=token).text
    except Exception:
        logger.warning("Could not load model card for %s", repo_id)
    return {
        "hf_repo_id": repo_id,
        "license": getattr(card_data, "license", None) if card_data else None,
        "downloads": getattr(info, "downloads", 0),
        "likes": getattr(info, "likes", 0),
        "readme": readme,
    }


def search(query: CatalogQuery) -> list[dict]:
    results: list[dict]
    if _api is not None:
        try:
            from .settings_store import get_hf_token

            token = get_hf_token()
            # The Hub query returns the top repos by downloads; local-only
            # filters would come back empty for anything rare in that slice.
            # Vision models are exactly that case, so ask the Hub for the
            # names the vision heuristic matches.
            searches: list[str | None] = [query.q or None]
            if query.vision and not query.q:
                searches = ["VL", "vision", "llava"]
            seen: set[str] = set()
            results = []
            for term in searches:
                for m in _api.list_models(
                    author="mlx-community",
                    search=term,
                    sort=_HUB_SORT[query.sort],
                    limit=max(query.limit * 2, 40),
                    token=token,
                ):
                    if m.id in seen or _NON_LLM_RE.search(m.id):
                        continue
                    seen.add(m.id)
                    meta = parse_repo_meta(m.id)
                    results.append(
                        {
                            "hf_repo_id": m.id,
                            "display_name": m.id.split("/")[-1].replace("-", " "),
                            "description": None,
                            "context_length": None,
                            "downloads_30d": getattr(m, "downloads", 0),
                            "likes": getattr(m, "likes", 0) or 0,
                            "last_modified": _iso(getattr(m, "last_modified", None)),
                            **meta,
                        }
                    )
            # Several Hub queries (the vision case) merge here, so re-apply the order.
            results.sort(key=_SORT_KEYS[query.sort], reverse=True)
        except Exception:
            logger.exception("Hugging Face catalog query failed; serving seed list")
            results = list(_SEED)
    else:
        results = list(_SEED)

    return [r for r in results if _matches(r, query)][: query.limit]


# Catalog sort -> the Hub's list_models sort field.
_HUB_SORT = {"downloads": "downloads", "likes": "likes", "recent": "lastModified"}

_SORT_KEYS = {
    "downloads": lambda r: r.get("downloads_30d") or 0,
    "likes": lambda r: r.get("likes") or 0,
    "recent": lambda r: r.get("last_modified") or "",
}


def _iso(value: object) -> str | None:
    isoformat = getattr(value, "isoformat", None)
    return isoformat() if callable(isoformat) else None


def _matches(r: dict, q: CatalogQuery) -> bool:
    if q.params_min is not None and (r.get("params_b") or 0) < q.params_min:
        return False
    if q.params_max is not None and (r.get("params_b") or 1e9) > q.params_max:
        return False
    if q.quant and r.get("quantization") != q.quant:
        return False
    if q.ctx_min is not None and (r.get("context_length") or 0) < q.ctx_min:
        return False
    if q.vision is not None and bool(r.get("vision")) != q.vision:
        return False
    if q.instruct is not None and bool(r.get("instruct")) != q.instruct:
        return False
    return True
