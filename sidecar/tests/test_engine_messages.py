"""Unit tests for chat message normalization and vision-model detection."""

from __future__ import annotations

import base64
import json
from pathlib import Path

import pytest

from mlxstudio.services.engine import (
    _decode_data_url,
    is_vision_model,
    normalize_chat_messages,
)

# 1x1 transparent PNG.
_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQAB"
    "h6FO1AAAAABJRU5ErkJggg=="
)
_PNG_DATA_URL = "data:image/png;base64," + base64.b64encode(_PNG_BYTES).decode()


def test_plain_text_messages_pass_through() -> None:
    messages = [{"role": "user", "content": "hello"}]
    texts, images, temp_files = normalize_chat_messages(messages)
    assert texts == [{"role": "user", "content": "hello"}]
    assert images == []
    assert temp_files == []


def test_content_parts_flatten_to_text_and_images() -> None:
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": _PNG_DATA_URL}},
                {"type": "text", "text": "what is this?"},
            ],
        }
    ]
    texts, images, temp_files = normalize_chat_messages(messages)
    assert texts == [{"role": "user", "content": "what is this?"}]
    assert len(images) == 1
    assert images == temp_files
    path = Path(temp_files[0])
    assert path.suffix == ".png"
    assert path.read_bytes() == _PNG_BYTES
    path.unlink()


def test_http_image_urls_are_passed_through_not_downloaded() -> None:
    url = "https://example.com/cat.jpg"
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": url}},
                {"type": "text", "text": "describe"},
            ],
        }
    ]
    _, images, temp_files = normalize_chat_messages(messages)
    assert images == [url]
    assert temp_files == []


def test_invalid_base64_raises() -> None:
    with pytest.raises(RuntimeError):
        _decode_data_url("data:image/png;base64,not-base64!!")


def test_non_base64_data_url_raises() -> None:
    with pytest.raises(RuntimeError):
        _decode_data_url("data:image/png,plain")


def test_is_vision_model_reads_config(tmp_path: Path) -> None:
    (tmp_path / "config.json").write_text(
        json.dumps({"model_type": "qwen2_vl", "vision_config": {}})
    )
    assert is_vision_model(str(tmp_path)) is True


def test_is_vision_model_false_for_text_llm(tmp_path: Path) -> None:
    (tmp_path / "config.json").write_text(json.dumps({"model_type": "qwen2"}))
    assert is_vision_model(str(tmp_path)) is False


def test_is_vision_model_false_without_config(tmp_path: Path) -> None:
    assert is_vision_model(str(tmp_path)) is False
