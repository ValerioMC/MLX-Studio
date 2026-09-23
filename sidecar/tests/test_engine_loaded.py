"""Loaded runners report their estimated memory footprint."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from mlxstudio.services import engine as engine_module
from mlxstudio.services.engine import Engine


def test_loaded_reports_estimated_ram(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(engine_module, "MLX_AVAILABLE", False)
    (tmp_path / "model.safetensors").write_bytes(b"\0" * 1000)
    (tmp_path / "config.json").write_text(
        json.dumps({"num_hidden_layers": 2, "hidden_size": 8, "num_attention_heads": 2})
    )
    engine = Engine()

    engine.load_model("tiny", str(tmp_path), context_length=16)

    [loaded] = engine.loaded()
    # 1000 weight + 2*2*16*2*4*2 KV + 150 overhead.
    assert loaded["est_ram_bytes"] == 1000 + 1024 + 150
    assert loaded["context_length"] == 16
