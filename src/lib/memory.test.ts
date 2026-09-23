import { describe, expect, it } from "vitest";
import { HEADLINE_READOUT_KEY, memoryCells, memoryLedger, nextTone, readoutKey } from "./memory";
import type { SystemStats } from "@/types";

const GB = 1024 ** 3;

function stats(overrides: Partial<SystemStats> = {}): SystemStats {
  return {
    ram_total: 64 * GB,
    ram_used: 30 * GB,
    ram_available: 34 * GB,
    swap_used: 0,
    cpu_percent: 5,
    disk_free: 100 * GB,
    reserve_bytes: 9.6 * GB,
    loaded_models: [],
    ...overrides,
  };
}

const name = (id: string) => id.toUpperCase();

describe("memoryLedger", () => {
  it("splits memory into in-use, reserve and free that add up to the total", () => {
    const ledger = memoryLedger(stats(), name);

    expect(ledger.segments.map((s) => s.kind)).toEqual(["system", "reserve", "free"]);
    expect(ledger.segments.reduce((a, s) => a + s.bytes, 0)).toBeCloseTo(64 * GB);
    expect(ledger.freeForModelsBytes).toBeCloseTo(24.4 * GB);
  });

  it("carves loaded models out of the in-use share", () => {
    const ledger = memoryLedger(
      stats({ loaded_models: [{ model_id: "qwen", context_length: 4096, est_ram_bytes: 10 * GB }] }),
      name,
    );

    const [model, system] = ledger.segments;
    expect(model).toMatchObject({ kind: "model", label: "QWEN", bytes: 10 * GB, tone: 0 });
    expect(system?.bytes).toBeCloseTo(20 * GB);
  });

  it("draws each model in the tone the sidecar gave it", () => {
    const ledger = memoryLedger(
      stats({
        loaded_models: [
          { model_id: "b", context_length: 4096, est_ram_bytes: 2 * GB, tone: 1 },
          { model_id: "c", context_length: 4096, est_ram_bytes: 2 * GB, tone: 2 },
        ],
      }),
      name,
      { label: "New", bytes: GB },
    );

    expect(ledger.segments.filter((s) => s.kind === "model").map((s) => s.tone)).toEqual([1, 2]);
    expect(ledger.segments.find((s) => s.kind === "pending")?.tone).toBe(0);
  });

  it("scales model estimates down to what the OS reports in use", () => {
    const ledger = memoryLedger(
      stats({
        ram_available: 60 * GB,
        loaded_models: [{ model_id: "big", context_length: 4096, est_ram_bytes: 8 * GB }],
      }),
      name,
    );

    expect(ledger.segments[0]?.bytes).toBe(4 * GB);
    expect(ledger.segments.some((s) => s.kind === "system")).toBe(false);
  });

  it("places a pending model in free memory and reports overflow", () => {
    const fits = memoryLedger(stats(), name, { label: "New", bytes: 10 * GB });
    expect(fits.overflowBytes).toBe(0);
    expect(fits.segments.find((s) => s.kind === "pending")?.bytes).toBe(10 * GB);

    const tooBig = memoryLedger(stats(), name, { label: "New", bytes: 30 * GB });
    expect(tooBig.overflowBytes).toBeCloseTo(5.6 * GB);
    expect(tooBig.segments.some((s) => s.kind === "free")).toBe(false);
  });

  it("shrinks the reserve when less than the reserve is available", () => {
    const ledger = memoryLedger(stats({ ram_available: 4 * GB }), name);

    expect(ledger.freeForModelsBytes).toBe(0);
    expect(ledger.segments.find((s) => s.kind === "reserve")?.bytes).toBe(4 * GB);
  });
});

describe("nextTone", () => {
  it("takes the lowest free tone, then the least shared", () => {
    expect(nextTone([])).toBe(0);
    expect(nextTone([0, 2])).toBe(1);
    expect(nextTone([0, 1, 2, 3])).toBe(0);
    expect(nextTone([0, 1, 2, 3, 0, 1])).toBe(2);
  });
});

describe("memoryCells", () => {
  it("gives one cell per GB when that fits, each owned by the segment at its midpoint", () => {
    const ledger = memoryLedger(
      stats({ loaded_models: [{ model_id: "qwen", context_length: 4096, est_ram_bytes: 10 * GB }] }),
      name,
    );
    const { cells, cellBytes } = memoryCells(ledger, 64);

    expect(cellBytes).toBe(GB);
    expect(cells).toHaveLength(64);
    expect(cells.slice(0, 10).every((c) => c.kind === "model" && c.tone === 0)).toBe(true);
    expect(cells[10]?.kind).toBe("system");
    expect(cells[cells.length - 1]?.kind).toBe("free");
  });

  it("doubles the cell size until the strip fits the limit", () => {
    const { cells, cellBytes } = memoryCells(memoryLedger(stats(), name), 48);

    expect(cellBytes).toBe(2 * GB);
    expect(cells).toHaveLength(32);
  });

  it("appends overflow cells for a pending model that does not fit, capped at a quarter of the strip", () => {
    const ledger = memoryLedger(stats(), name, { label: "huge", bytes: 200 * GB });
    const { cells } = memoryCells(ledger, 64);

    const overflow = cells.filter((c) => c.kind === "overflow");
    expect(overflow).toHaveLength(16);
    expect(cells.slice(0, 64).some((c) => c.kind === "pending")).toBe(true);
  });
});

describe("readoutKey", () => {
  it("renders the headline under its own key when nothing is pointed at", () => {
    expect(readoutKey(null)).toBe(HEADLINE_READOUT_KEY);
  });

  it("never gives a segment the headline's key, including the Free segment", () => {
    const ledger = memoryLedger(
      stats({ loaded_models: [{ model_id: "free", context_length: 4096, est_ram_bytes: 8 * GB, tone: 0 }] }),
      name,
    );

    const keys = ledger.segments.map((segment) => readoutKey(segment));

    expect(ledger.segments.map((s) => s.key)).toContain("free");
    expect(keys).not.toContain(HEADLINE_READOUT_KEY);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
