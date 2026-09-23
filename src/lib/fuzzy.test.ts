import { describe, expect, it } from "vitest";
import { fuzzyScore } from "./fuzzy";

describe("fuzzyScore", () => {
  it("matches everything with an empty query", () => {
    expect(fuzzyScore("  ", "Models")).toBe(0);
  });

  it("rejects a label missing a query character", () => {
    expect(fuzzyScore("xyz", "Models")).toBeNull();
  });

  it("requires the characters in order", () => {
    expect(fuzzyScore("ledom", "Models")).toBeNull();
  });

  it("ignores case", () => {
    expect(fuzzyScore("MOD", "models")).not.toBeNull();
  });

  it("ranks word starts and consecutive runs above scattered matches", () => {
    const newChat = fuzzyScore("nch", "New chat") ?? -Infinity;
    const launch = fuzzyScore("nch", "Launch") ?? -Infinity;
    expect(newChat).toBeGreaterThan(launch);
  });

  it("prefers the shorter label when the match is the same", () => {
    const short = fuzzyScore("chat", "Chat") ?? -Infinity;
    const long = fuzzyScore("chat", "Chat with Qwen3 8B") ?? -Infinity;
    expect(short).toBeGreaterThan(long);
  });
});
