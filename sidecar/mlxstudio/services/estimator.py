"""Heuristics for download size and RAM footprint, used to gate downloads/loads."""

from __future__ import annotations

import json
import re
from pathlib import Path

# Bytes per parameter for the non-integer formats (weights only); "<n>bit"
# quantizations are n/8. MX/NV FP4 carry a shared scale per block of 32/16.
_BYTES_PER_PARAM = {
    "bf16": 2.0,
    "fp16": 2.0,
    "fp32": 4.0,
    "mxfp4": 0.53,
    "nvfp4": 0.56,
}

_NBIT_RE = re.compile(r"^(\d+)bit$")


def bytes_per_param(quant: str | None) -> float:
    """Unknown or missing quantization is assumed to be bf16, the usual unquantized format."""
    key = (quant or "bf16").lower()
    if match := _NBIT_RE.match(key):
        return int(match.group(1)) / 8
    return _BYTES_PER_PARAM.get(key, 2.0)


def weight_bytes(params_b: float | None, quant: str | None) -> int | None:
    if params_b is None:
        return None
    return int(params_b * 1e9 * bytes_per_param(quant))


def kv_cache_bytes(config: dict, ctx: int) -> int:
    """Precise KV-cache size from a model's config.json."""
    layers = config.get("num_hidden_layers", 32)
    hidden = config.get("hidden_size", 4096)
    n_heads = config.get("num_attention_heads", 32)
    n_kv = config.get("num_key_value_heads", n_heads)
    head_dim = hidden // max(n_heads, 1)
    # 2 (K+V) * layers * ctx * kv_heads * head_dim * 2 bytes (fp16)
    return 2 * layers * ctx * n_kv * head_dim * 2


def estimate_ram(params_b: float | None, quant: str | None, config: dict | None, ctx: int) -> int | None:
    wb = weight_bytes(params_b, quant)
    if wb is None:
        return None
    kv = kv_cache_bytes(config, ctx) if config else int(0.1 * wb)
    overhead = int(0.15 * wb)  # activations, framework, tokenizer
    return wb + kv + overhead


def read_config(local_path: str | None) -> dict | None:
    if not local_path:
        return None
    cfg_file = Path(local_path) / "config.json"
    if not cfg_file.exists():
        return None
    try:
        cfg = json.loads(cfg_file.read_text())
    except json.JSONDecodeError:
        return None
    # Multimodal repos nest the LLM params under text_config; flatten them so
    # kv_cache_bytes and max-context lookups see the real values.
    text_config = cfg.get("text_config")
    if isinstance(text_config, dict):
        cfg = {**cfg, **text_config}
    return cfg


def local_weight_bytes(local_path: str | None) -> int | None:
    """Actual weight size on disk. More accurate than the params-count heuristic,
    which drifts on MoE models and mixed-precision quantizations."""
    if not local_path:
        return None
    path = Path(local_path)
    if not path.is_dir():
        return None
    total = sum(f.stat().st_size for f in path.glob("*.safetensors"))
    return total or None


def installed_breakdown(
    local_path: str | None, params_b: float | None, quant: str | None, ctx: int
) -> dict | None:
    """RAM breakdown for an installed model, preferring on-disk facts (weight
    size, config.json) over name-derived heuristics."""
    config = read_config(local_path)
    weight = local_weight_bytes(local_path) or weight_bytes(params_b, quant)
    if weight is None:
        return None
    kv = kv_cache_bytes(config, ctx) if config else int(0.1 * weight)
    overhead = int(0.15 * weight)
    return {
        "weight_bytes": weight,
        "kv_cache_bytes": kv,
        "overhead_bytes": overhead,
        "est_ram_bytes": weight + kv + overhead,
        "max_context": (config or {}).get("max_position_embeddings"),
    }
