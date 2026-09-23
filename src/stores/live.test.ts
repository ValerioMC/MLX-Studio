import { describe, expect, it } from "vitest";
import { appendSample } from "./live";

describe("appendSample", () => {
  it("appends the new reading after the older ones", () => {
    expect(appendSample([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it("drops the oldest readings past the limit", () => {
    expect(appendSample([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it("does not mutate the history it was given", () => {
    const history = [1, 2];
    appendSample(history, 3);
    expect(history).toEqual([1, 2]);
  });
});
