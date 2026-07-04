"""Heuristics for download size and RAM footprint, used to gate downloads/loads."""

from __future__ import annotations

import json
from pathlib import Path

# Bytes per parameter by quantization (weights only).
_BYTES_PER_PARAM = {
    "4bit": 0.5,
    "8bit": 1.0,
    "bf16": 2.0,
    "fp16": 2.0,
    "fp32": 4.0,
}


def weight_bytes(params_b: float | None, quant: str | None) -> int | None:
    if params_b is None:
        return None
    per = _BYTES_PER_PARAM.get((quant or "bf16").lower(), 2.0)
    return int(params_b * 1e9 * per)


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
    cfg = Path(local_path) / "config.json"
    if cfg.exists():
        try:
            return json.loads(cfg.read_text())
        except json.JSONDecodeError:
            return None
    return None
