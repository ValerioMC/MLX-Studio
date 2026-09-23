import type { MemoryCell, MemorySegment } from "@/lib/memory";

const MODEL_FILL = ["bg-seg-0", "bg-seg-1", "bg-seg-2", "bg-seg-3"] as const;
const MODEL_OUTLINE = ["ring-seg-0", "ring-seg-1", "ring-seg-2", "ring-seg-3"] as const;

/**
 * The fill for a memory segment or cell, shared by the strip, the legend and
 * anything else that draws memory, so a model's slice is the same color
 * everywhere (its tone, which ModelCore and the dial use too).
 */
export function segmentClass(segment: Pick<MemorySegment, "kind" | "tone"> | MemoryCell): string {
  const tone = (segment.tone ?? 0) % MODEL_FILL.length;
  switch (segment.kind) {
    case "model":
      return MODEL_FILL[tone] ?? MODEL_FILL[0];
    case "pending":
      return `bg-transparent ring-1 ring-inset ${MODEL_OUTLINE[tone] ?? MODEL_OUTLINE[0]}`;
    case "system":
      return "bg-seg-system/70";
    case "reserve":
      return "bg-hatch";
    case "free":
      return "bg-fg/[0.07]";
    case "overflow":
      return "bg-danger-soft ring-1 ring-inset ring-danger";
  }
}
