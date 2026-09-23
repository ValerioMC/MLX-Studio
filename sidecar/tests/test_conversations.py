import pytest
from fastapi.testclient import TestClient

from mlxstudio.config import get_settings
from mlxstudio.main import create_app

AUTH = {"Authorization": f"Bearer {get_settings().token}"}


@pytest.fixture()
def client():
    with TestClient(create_app()) as c:
        yield c


def test_conversation_lifecycle(client):
    created = client.post("/conversations", json={"model_id": "qwen-test"}, headers=AUTH).json()
    assert created["title"] is None
    conv_id = created["id"]

    saved = client.post(
        f"/conversations/{conv_id}/messages",
        json={
            "messages": [
                {"role": "user", "content": "What is MLX?"},
                {"role": "assistant", "content": "A framework.", "tok_per_sec": 42.5},
            ]
        },
        headers=AUTH,
    ).json()
    assert saved["title"] == "What is MLX?"

    items = client.get(f"/conversations/{conv_id}/messages", headers=AUTH).json()["items"]
    assert [m["role"] for m in items] == ["user", "assistant"]
    assert items[1]["tok_per_sec"] == 42.5

    listed = client.get("/conversations", headers=AUTH).json()["items"]
    assert any(c["id"] == conv_id for c in listed)

    renamed = client.patch(
        f"/conversations/{conv_id}", json={"title": "Renamed"}, headers=AUTH
    ).json()
    assert renamed["title"] == "Renamed"

    assert client.delete(f"/conversations/{conv_id}", headers=AUTH).json() == {"ok": True}
    assert client.get(f"/conversations/{conv_id}/messages", headers=AUTH).status_code == 404


def test_conversations_require_auth(client):
    assert client.get("/conversations").status_code == 401


def test_replace_messages_rewrites_thread_and_keeps_title(client):
    conv_id = client.post("/conversations", json={}, headers=AUTH).json()["id"]
    client.post(
        f"/conversations/{conv_id}/messages",
        json={
            "messages": [
                {"role": "user", "content": "Name a color"},
                {"role": "assistant", "content": "Red."},
            ]
        },
        headers=AUTH,
    )

    replaced = client.put(
        f"/conversations/{conv_id}/messages",
        json={
            "messages": [
                {"role": "user", "content": "Name a color"},
                {"role": "assistant", "content": "Blue.", "tok_per_sec": 30.0},
            ]
        },
        headers=AUTH,
    )

    assert replaced.status_code == 200
    assert replaced.json()["title"] == "Name a color"
    items = client.get(f"/conversations/{conv_id}/messages", headers=AUTH).json()["items"]
    assert [m["content"] for m in items] == ["Name a color", "Blue."]


def test_replace_messages_unknown_conversation(client):
    response = client.put("/conversations/nope/messages", json={"messages": []}, headers=AUTH)
    assert response.status_code == 404
