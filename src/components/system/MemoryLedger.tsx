import { cn } from "@/lib/utils";
import { bytes, gigabytes } from "@/lib/format";
import { type MemoryLedger as Ledger, type MemorySegment } from "@/lib/memory";

const MODEL_FILL = ["bg-seg-0", "bg-seg-1", "bg-seg-2", "bg-seg-3"] as const;
const MODEL_OUTLINE = ["border-seg-0", "border-seg-1", "border-seg-2", "border-seg-3"] as const;

function segmentClass(segment: MemorySegment): string {
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

/** The bar itself: the Mac's whole unified memory, left to right. */
export function LedgerBar({
  ledger,
  height = "h-7",
  className,
  overflow = false,
}: {
  ledger: Ledger;
  height?: string;
  className?: string;
  /** Marks the right edge red: a pending model does not fit. */
  overflow?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={ledger.segments.map((s) => `${s.label} ${bytes(s.bytes)}`).join(", ")}
      className={cn(
        "flex w-full gap-[2px] overflow-hidden rounded-[5px] bg-muted p-[2px]",
        overflow && "ring-1 ring-destructive",
        height,
        className,
      )}
    >
      {ledger.segments.map((segment) => (
        <div
          key={segment.key}
          title={`${segment.label}: ${bytes(segment.bytes)}`}
          className={cn(
            "h-full min-w-[2px] rounded-[3px] transition-[flex-grow] duration-500 ease-out",
            segmentClass(segment),
            segment.kind === "pending" && "animate-pulse",
          )}
          style={{ flexGrow: segment.bytes, flexBasis: 0 }}
        />
      ))}
    </div>
  );
}

function Swatch({ segment }: { segment: MemorySegment }) {
  return <span aria-hidden className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", segmentClass(segment), segment.kind === "free" && "border border-input")} />;
}

/** Legend under the bar: what each segment is and how much it takes. */
export function LedgerLegend({ ledger, className }: { ledger: Ledger; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-5 gap-y-1.5", className)}>
      {ledger.segments.map((segment) => (
        <li key={segment.key} className="flex min-w-0 items-center gap-1.5 text-sm">
          <Swatch segment={segment} />
          <span className="max-w-[18ch] truncate text-muted-foreground">{segment.label}</span>
          <span className="tabular font-medium">{bytes(segment.bytes)}</span>
        </li>
      ))}
    </ul>
  );
}

/** The headline figure: what a new model can take right now. */
export function FreeForModels({ ledger, size = "hero" }: { ledger: Ledger; size?: "hero" | "compact" }) {
  if (size === "compact") {
    return (
      <p className="text-xs text-muted-foreground">
        <span className="tabular font-semibold text-foreground">{gigabytes(ledger.freeForModelsBytes)} GB</span> free
        for models
      </p>
    );
  }
  return (
    <p className="flex items-baseline gap-3">
      <span className="figure text-3xl font-semibold">
        {gigabytes(ledger.freeForModelsBytes)}
        <span className="ml-1 text-xl font-medium text-muted-foreground">GB</span>
      </span>
      <span className="text-md text-muted-foreground">
        free for models, of {gigabytes(ledger.totalBytes)} GB unified memory
      </span>
    </p>
  );
}
