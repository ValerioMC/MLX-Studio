import type { SystemStats } from "@/types";

/**
 * How the Mac's unified memory is split, for the memory ledger.
 *
 * psutil's "available" is what macOS can hand out without swapping. Of that, a
 * safety reserve stays with the OS; the rest is what a model can take. What is
 * not available is in use, split between loaded models (by their estimate) and
 * everything else.
 */
export type SegmentKind = "model" | "system" | "reserve" | "free" | "pending";

export interface MemorySegment {
  readonly key: string;
  readonly kind: SegmentKind;
  readonly label: string;
  readonly bytes: number;
  /** Position in the model palette, for model and pending segments. */
  readonly tone?: number;
}

export interface MemoryLedger {
  readonly totalBytes: number;
  readonly segments: readonly MemorySegment[];
  /** Memory a new model can take right now (free minus reserve). */
  readonly freeForModelsBytes: number;
  /** Bytes a pending model would need beyond what is free for models. */
  readonly overflowBytes: number;
}

export interface PendingModel {
  readonly label: string;
  readonly bytes: number;
}

/** Number of distinct model tones in the palette (see --seg-* tokens). */
export const MODEL_TONES = 4;

/**
 * The tone the sidecar gives the next model it loads (mirrors `next_tone` in
 * the engine): the lowest one no loaded model uses, else the one fewest share.
 */
export function nextTone(used: readonly number[]): number {
  const counts = Array.from({ length: MODEL_TONES }, (_, tone) => used.filter((t) => t === tone).length);
  const free = counts.indexOf(0);
  if (free !== -1) return free;
  return counts.indexOf(Math.min(...counts));
}

export function memoryLedger(
  stats: SystemStats,
  nameOf: (modelId: string) => string,
  pending?: PendingModel,
): MemoryLedger {
  const total = stats.ram_total;
  const available = clamp(stats.ram_available, 0, total);
  const inUse = total - available;

  // Each model keeps the tone the sidecar gave it at load; older sidecars send
  // none, so fall back to load order.
  const tones = stats.loaded_models.map((m, index) => m.tone ?? index % MODEL_TONES);
  const models = stats.loaded_models
    .map((m, index): MemorySegment => ({
      key: `model:${m.model_id}`,
      kind: "model",
      label: nameOf(m.model_id),
      bytes: m.est_ram_bytes ?? 0,
      tone: tones[index],
    }))
    .filter((m) => m.bytes > 0);
  const modelBytes = sum(models.map((m) => m.bytes));
  // Estimates can exceed what the OS reports in use (weights paged out, cache
  // not yet grown); never let models push past the in-use share.
  const scale = modelBytes > inUse && modelBytes > 0 ? inUse / modelBytes : 1;
  const scaledModels = models.map((m) => ({ ...m, bytes: Math.round(m.bytes * scale) }));
  const systemBytes = inUse - sum(scaledModels.map((m) => m.bytes));

  const reserve = Math.min(stats.reserve_bytes ?? 0, available);
  const freeForModels = available - reserve;

  const segments: MemorySegment[] = [
    ...scaledModels,
    { key: "system", kind: "system", label: "macOS and apps", bytes: systemBytes },
    { key: "reserve", kind: "reserve", label: "Safety reserve", bytes: reserve },
  ];

  let overflow = 0;
  if (pending) {
    const placed = Math.min(pending.bytes, freeForModels);
    overflow = pending.bytes - placed;
    segments.push({
      key: "pending",
      kind: "pending",
      label: pending.label,
      bytes: placed,
      tone: nextTone(tones),
    });
    segments.push({ key: "free", kind: "free", label: "Free", bytes: freeForModels - placed });
  } else {
    segments.push({ key: "free", kind: "free", label: "Free", bytes: freeForModels });
  }

  return {
    totalBytes: total,
    segments: segments.filter((s) => s.bytes > 0 || s.kind === "pending"),
    freeForModelsBytes: freeForModels,
    overflowBytes: overflow,
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
