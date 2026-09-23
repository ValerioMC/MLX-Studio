import { describe, expect, it } from "vitest";
import { fitWithin, MAX_IMAGE_EDGE } from "./image";

describe("fitWithin", () => {
  it("leaves images that already fit untouched", () => {
    const size = { width: 1200, height: 800 };
    expect(fitWithin(size, MAX_IMAGE_EDGE)).toBe(size);
  });

  it("scales the longest edge down to the limit, keeping the aspect ratio", () => {
    expect(fitWithin({ width: 4032, height: 3024 }, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin({ width: 1000, height: 5000 }, 1600)).toEqual({ width: 320, height: 1600 });
  });

  it("never rounds an edge down to zero", () => {
    expect(fitWithin({ width: 10000, height: 2 }, 1600)).toEqual({ width: 1600, height: 1 });
  });
});
