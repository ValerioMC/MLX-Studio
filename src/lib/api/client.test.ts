import { describe, expect, it } from "vitest";
import { errorMessage } from "./client";

describe("errorMessage", () => {
  it("reads a plain string detail", () => {
    expect(errorMessage({ detail: "Model not installed" }, "x")).toBe("Model not installed");
  });

  it("reads the sidecar's typed errors", () => {
    expect(errorMessage({ detail: { type: "insufficient_memory", message: "Too big" } }, "x")).toBe("Too big");
  });

  it("reads the first validation error", () => {
    expect(errorMessage({ detail: [{ msg: "Input should be 'downloads'" }] }, "x")).toBe(
      "Input should be 'downloads'",
    );
  });

  it("reads OpenAI-style errors", () => {
    expect(errorMessage({ error: { message: "Bad key" } }, "x")).toBe("Bad key");
  });

  it("falls back for anything else", () => {
    expect(errorMessage(null, "Unauthorized")).toBe("Unauthorized");
    expect(errorMessage({}, "Unauthorized")).toBe("Unauthorized");
  });
});
