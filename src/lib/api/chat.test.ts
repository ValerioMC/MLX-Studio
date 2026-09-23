import { describe, expect, it } from "vitest";
import { readChunk } from "./chat";

describe("readChunk", () => {
  it("reads a content delta", () => {
    expect(readChunk('{"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}')).toEqual({
      delta: "Hi",
      finishReason: undefined,
      tokPerSec: undefined,
      timeToFirstToken: undefined,
    });
  });

  it("reads the final chunk's finish reason and usage", () => {
    const event = readChunk(
      '{"choices":[{"delta":{},"finish_reason":"length"}],"usage":{"tok_per_sec":41.5,"time_to_first_token":0.4}}',
    );

    expect(event).toMatchObject({ delta: "", finishReason: "length", tokPerSec: 41.5, timeToFirstToken: 0.4 });
  });

  it("flags in-band generation errors", () => {
    const event = readChunk('{"choices":[{"delta":{"content":"\\n\\n[error] boom"},"finish_reason":"error"}]}');

    expect(event?.finishReason).toBe("error");
  });

  it("ignores unknown finish reasons and malformed payloads", () => {
    expect(readChunk('{"choices":[{"delta":{},"finish_reason":"weird"}]}')?.finishReason).toBeUndefined();
    expect(readChunk("not json")).toBeNull();
  });
});
