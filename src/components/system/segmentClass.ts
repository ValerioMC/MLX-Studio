import { cn } from "@/lib/utils";
import type { MemorySegment } from "@/lib/memory";

const MODEL_FILL = ["bg-seg-0", "bg-seg-1", "bg-seg-2", "bg-seg-3"] as const;
const MODEL_OUTLINE = ["border-seg-0", "border-seg-1", "border-seg-2", "border-seg-3"] as const;

export function segmentClass(segment: MemorySegment): string {
  const tone = segment.tone ?? 0;
  switch (segment.kind) {
    case "model":
      return MODEL_FILL[tone] ?? MODEL_FILL[0];
    case "pending":
      return cn("border border-dashed bg-transparent", MODEL_OUTLINE[tone] ?? MODEL_OUTLINE[0]);
    case "system":
      return "bg-seg-system";
    case "reserve":
      return "bg-hatch";
    case "free":
      return "bg-transparent";
  }
}
