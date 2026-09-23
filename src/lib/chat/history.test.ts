import { describe, expect, it } from "vitest";
import { toModelHistory, toStoredMessages } from "./history";
import type { UIMsg } from "@/stores/chat";

const user = (content: string, images?: string[]): UIMsg => ({ id: content, role: "user", content, images });
const assistant = (content: string, extra: Partial<UIMsg> = {}): UIMsg => ({
  id: content,
  role: "assistant",
  content,
  ...extra,
});

describe("toModelHistory", () => {
  it("puts a non-blank system prompt first", () => {
    expect(toModelHistory([user("Hi")], "  Be brief.  ")).toEqual([
      { role: "system", content: "Be brief." },
      { role: "user", content: "Hi" },
    ]);
    expect(toModelHistory([user("Hi")], "   ")).toEqual([{ role: "user", content: "Hi" }]);
  });

  it("drops reasoning from past answers and skips failed replies", () => {
    const history = toModelHistory(
      [user("Q1"), assistant("<think>hmm</think>A1"), user("Q2"), assistant("", { error: "boom" })],
      "",
    );

    expect(history).toEqual([
      { role: "user", content: "Q1" },
      { role: "assistant", content: "A1" },
      { role: "user", content: "Q2" },
    ]);
  });

  it("sends images as content parts before the text", () => {
    const [message] = toModelHistory([user("What is this?", ["data:image/png;base64,AA"])], "");

    expect(message?.content).toEqual([
      { type: "image_url", image_url: { url: "data:image/png;base64,AA" } },
      { type: "text", text: "What is this?" },
    ]);
  });
});

describe("toStoredMessages", () => {
  it("keeps finished turns with their speed", () => {
    const stored = toStoredMessages([
      user("Q"),
      assistant("A", { tokPerSec: 40 }),
      assistant("", { error: "boom" }),
      assistant("partial", { streaming: true }),
    ]);

    expect(stored).toEqual([
      { role: "user", content: "Q", tok_per_sec: null },
      { role: "assistant", content: "A", tok_per_sec: 40 },
    ]);
  });
});
