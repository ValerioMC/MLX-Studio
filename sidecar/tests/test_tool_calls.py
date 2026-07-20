"""Unit tests for tool-call scanning, parsing, and message normalization."""

from __future__ import annotations

import json

from mlxstudio.services.engine import (
    ParsedToolCall,
    normalize_chat_messages,
    scan_tool_calls,
)


def _json_parser(text: str, tools: list[dict] | None):
    """Same contract as mlx_lm.tool_parsers.json_tools.parse_tool_call."""
    return json.loads(text.strip())


def _scan(chunks: list[str], *, end_marker: str | None = "</tool_call>"):
    return list(
        scan_tool_calls(
            iter(chunks),
            start_marker="<tool_call>",
            end_marker=end_marker,
            parser=_json_parser,
            tools=None,
        )
    )


_CALL_JSON = '{"name": "get_weather", "arguments": {"city": "Rome"}}'


def test_plain_text_passes_through() -> None:
    events = _scan(["Hello ", "world"])
    assert "".join(e for e in events if isinstance(e, str)) == "Hello world"
    assert not [e for e in events if isinstance(e, ParsedToolCall)]


def test_single_tool_call_in_one_chunk() -> None:
    events = _scan([f"<tool_call>{_CALL_JSON}</tool_call>"])
    assert len(events) == 1
    call = events[0]
    assert isinstance(call, ParsedToolCall)
    assert call.name == "get_weather"
    assert json.loads(call.arguments) == {"city": "Rome"}
    assert call.id.startswith("call_")


def test_marker_split_across_chunks() -> None:
    text = f"Sure: <tool_call>{_CALL_JSON}</tool_call> done"
    # Emit in 3-character chunks so both markers are split across chunks.
    events = _scan([text[i : i + 3] for i in range(0, len(text), 3)])
    calls = [e for e in events if isinstance(e, ParsedToolCall)]
    assert len(calls) == 1
    assert calls[0].name == "get_weather"
    assert "".join(e for e in events if isinstance(e, str)) == "Sure:  done"


def test_multiple_tool_calls() -> None:
    second = '{"name": "get_time", "arguments": {}}'
    events = _scan(
        [f"<tool_call>{_CALL_JSON}</tool_call>", f"<tool_call>{second}</tool_call>"]
    )
    calls = [e for e in events if isinstance(e, ParsedToolCall)]
    assert [c.name for c in calls] == ["get_weather", "get_time"]
    assert json.loads(calls[1].arguments) == {}


def test_no_end_marker_parses_at_stream_end() -> None:
    events = _scan([f"<tool_call>{_CALL_JSON}"], end_marker=None)
    calls = [e for e in events if isinstance(e, ParsedToolCall)]
    assert len(calls) == 1
    assert calls[0].name == "get_weather"


def test_truncated_tool_json_is_skipped_not_raised() -> None:
    events = _scan(['<tool_call>{"name": "get_w'])
    assert events == []


def test_parser_returning_list_yields_each_call() -> None:
    def list_parser(text: str, tools: list[dict] | None):
        return [
            {"name": "a", "arguments": {"x": 1}},
            {"name": "b", "arguments": {}},
        ]

    events = list(
        scan_tool_calls(
            iter(["<tool_call>ignored</tool_call>"]),
            start_marker="<tool_call>",
            end_marker="</tool_call>",
            parser=list_parser,
            tools=None,
        )
    )
    assert [e.name for e in events] == ["a", "b"]


def test_normalize_parses_tool_call_arguments_to_dict() -> None:
    messages = [
        {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": "call_1",
                    "type": "function",
                    "function": {"name": "get_weather", "arguments": '{"city": "Rome"}'},
                }
            ],
        },
        {"role": "tool", "tool_call_id": "call_1", "content": "18C, sunny"},
    ]
    texts, images, temp_files = normalize_chat_messages(messages)
    assert images == [] and temp_files == []
    assistant = texts[0]
    assert assistant["content"] == ""
    assert assistant["tool_calls"][0]["function"]["arguments"] == {"city": "Rome"}
    assert texts[1] == {"role": "tool", "tool_call_id": "call_1", "content": "18C, sunny"}
