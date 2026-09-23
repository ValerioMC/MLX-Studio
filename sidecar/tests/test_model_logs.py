"""Per-model logs: what gets written, what the endpoint returns, and what never does."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from mlxstudio.config import get_settings
from mlxstudio.main import create_app
from mlxstudio.services import engine as engine_module
from mlxstudio.services.engine import Engine, engine

AUTH = {"Authorization": f"Bearer {get_settings().token}"}
API_KEY = {"Authorization": f"Bearer {get_settings().api_key}"}
SECRET = "SECRET-PROMPT-7731"


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


def _model_dir(root: Path) -> str:
    (root / "model.safetensors").write_bytes(b"\0" * 100)
    return str(root)


def _lines(client: TestClient, model_id: str) -> list[str]:
    return client.get(f"/models/{model_id}/logs", headers=AUTH).json()["lines"]


def test_load_generation_and_unload_are_logged_without_text(
    client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(engine_module, "MLX_AVAILABLE", False)
    engine.load_model("log-tiny", _model_dir(tmp_path), context_length=2048)
    try:
        reply = client.post(
            "/v1/chat/completions",
            json={"model": "log-tiny", "messages": [{"role": "user", "content": SECRET}]},
            headers=API_KEY,
        )
        assert reply.status_code == 200
        assert SECRET in reply.json()["choices"][0]["message"]["content"]  # the stub echoes it
    finally:
        engine.unload_model("log-tiny")

    lines = _lines(client, "log-tiny")
    text = "\n".join(lines)
    assert "Loading with 2048-token context" in text
    assert "Loaded in" in text
    assert "Generated" in text and "finished: stop" in text
    assert "Unloaded" in text
    assert SECRET not in text


def test_failed_load_is_logged(client: TestClient, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def broken(_self: Engine, _runner: object) -> None:
        raise RuntimeError("weights are corrupt")

    monkeypatch.setattr(Engine, "_load_weights", broken)

    with pytest.raises(RuntimeError):
        Engine().load_model("log-broken", _model_dir(tmp_path))

    assert any("Load failed" in line for line in _lines(client, "log-broken"))
    assert any("weights are corrupt" in line for line in _lines(client, "log-broken"))


def test_unknown_model_has_no_log(client: TestClient) -> None:
    assert _lines(client, "never-loaded") == []
