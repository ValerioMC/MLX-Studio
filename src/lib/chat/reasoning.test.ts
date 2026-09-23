import { describe, expect, it } from "vitest";
import { splitReasoning, stripReasoning } from "./reasoning";

describe("splitReasoning", () => {
  it("passes plain answers through", () => {
    expect(splitReasoning("Hello there")).toEqual({ reasoning: null, answer: "Hello there", thinking: false });
  });

  it("splits a complete think block from the answer", () => {
    expect(splitReasoning("<think>\nWeigh it.\n</think>\n\nThe answer.")).toEqual({
      reasoning: "Weigh it.",
      answer: "The answer.",
      thinking: false,
    });
  });

  it("reports an unfinished block as still thinking", () => {
    expect(splitReasoning("<think>Considering")).toEqual({
      reasoning: "Considering",
      answer: "",
      thinking: true,
    });
  });

  it("handles templates that open the block in the prompt", () => {
    expect(splitReasoning("Step one.</think>Done.")).toEqual({
      reasoning: "Step one.",
      answer: "Done.",
      thinking: false,
    });
  });

  it("treats an empty block (thinking disabled) as no reasoning", () => {
    expect(splitReasoning("<think>\n\n</think>\n\nDirect.")).toEqual({
      reasoning: null,
      answer: "Direct.",
      thinking: false,
    });
  });

  it("leaves a tag quoted mid-answer alone", () => {
    const text = "Use the <think> tag to reason.";
    expect(splitReasoning(text)).toEqual({ reasoning: null, answer: text, thinking: false });
  });
});

describe("stripReasoning", () => {
  it("keeps only the answer", () => {
    expect(stripReasoning("<think>x</think>Answer")).toBe("Answer");
  });
});
