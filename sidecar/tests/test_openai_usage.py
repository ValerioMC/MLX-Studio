"""finish_reason and usage reporting for the OpenAI-compatible endpoint."""

from __future__ import annotations

import pytest

from mlxstudio.api.openai import finish_reason, generation_usage


def test_finish_reason_prefers_tool_calls() -> None:
    assert finish_reason(tool_call_count=1, generated=1024, max_tokens=1024) == "tool_calls"


def test_finish_reason_length_when_token_limit_reached() -> None:
    assert finish_reason(tool_call_count=0, generated=1024, max_tokens=1024) == "length"


def test_finish_reason_stop_below_limit() -> None:
    assert finish_reason(tool_call_count=0, generated=12, max_tokens=1024) == "stop"


def test_usage_speed_excludes_prompt_processing() -> None:
    # 2 s of prompt processing, then 11 tokens over 1 s of decoding.
    usage = generation_usage(11, started_at=100.0, first_token_at=102.0, ended_at=103.0)

    assert usage["completion_tokens"] == 11
    assert usage["time_to_first_token"] == pytest.approx(2.0)
    assert usage["tok_per_sec"] == pytest.approx(10.0)


def test_usage_without_tokens_has_no_speed() -> None:
    usage = generation_usage(0, started_at=100.0, first_token_at=None, ended_at=101.0)

    assert usage["tok_per_sec"] == 0.0
    assert usage["time_to_first_token"] is None
