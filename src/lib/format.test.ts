import { describe, expect, it } from "vitest";
import { bytes, compactNumber, contextSize, eta, gigabytes, params, percent } from "./format";

describe("format", () => {
  it("formats bytes with one decimal under ten units", () => {
    expect(bytes(1536)).toBe("1.5 KB");
    expect(bytes(20 * 1024 ** 3)).toBe("20 GB");
    expect(bytes(null)).toBe("—");
  });

  it("prints gigabytes without a unit", () => {
    expect(gigabytes(4.26 * 1024 ** 3)).toBe("4.3");
    expect(gigabytes(48.6 * 1024 ** 3)).toBe("49");
  });

  it("formats parameter counts", () => {
    expect(params(7)).toBe("7B");
    expect(params(0.6)).toBe("600M");
  });

  it("caps percentages at 100", () => {
    expect(percent(5, 4)).toBe(100);
    expect(percent(1, 0)).toBe(0);
  });

  it("abbreviates large counts", () => {
    expect(compactNumber(1234)).toBe("1.2K");
  });

  it("quotes context in K", () => {
    expect(contextSize(131072)).toBe("128K");
    expect(contextSize(512)).toBe("512");
  });

  it("estimates time left", () => {
    expect(eta(10, 100)).toBe("under a minute left");
    expect(eta(600 * 1000, 1000)).toBe("about 10 min left");
    expect(eta(5400 * 1000, 1000)).toBe("about 1 h 30 min left");
    expect(eta(100, 0)).toBeNull();
  });
});
