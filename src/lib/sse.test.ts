import { describe, expect, it } from "vitest";
import { drainFrames } from "./sse";

describe("drainFrames", () => {
  it("returns complete frames and keeps the partial tail", () => {
    const { payloads, rest } = drainFrames('event: progress\ndata: {"a":1}\n\ndata: {"b"');

    expect(payloads).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"b"');
  });

  it("accepts CRLF separators", () => {
    expect(drainFrames('data: {"a":1}\r\n\r\n').payloads).toEqual(['{"a":1}']);
  });

  it("joins multi-line data fields and skips frames without data", () => {
    const { payloads } = drainFrames(": ping\n\ndata: line one\ndata: line two\n\n");

    expect(payloads).toEqual(["line one\nline two"]);
  });
});
