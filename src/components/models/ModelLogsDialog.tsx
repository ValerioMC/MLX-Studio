import { useLayoutEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { CopyButton } from "@/components/ui/controls";
import { InlineError } from "@/components/ui/primitives";
import type { Model } from "@/types";

const TAIL_LINES = 200;
const REFRESH_MS = 2000;
/** Within this distance of the end, new lines keep the view pinned to the bottom. */
const STICK_THRESHOLD_PX = 32;

/** The model's diagnostic log: loads, timings, throughput and failures, never chat text. */
export function ModelLogsDialog({ model, onClose }: { model: Model; onClose: () => void }) {
  const { data: lines, isError, error } = useQuery({
    queryKey: ["model-logs", model.id],
    queryFn: () =>
      api<{ lines: string[] }>(`/models/${encodeURIComponent(model.id)}/logs?tail=${TAIL_LINES}`).then((r) => r.lines),
    refetchInterval: REFRESH_MS,
  });
  const scrollRef = useRef<HTMLPreElement>(null);
  const stuckRef = useRef(true);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && stuckRef.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const text = (lines ?? []).join("\n");

  return (
    <Dialog
      title={`${model.display_name} log`}
      description={`The last ${TAIL_LINES} lines, refreshed every ${REFRESH_MS / 1000} s. Chat text is never logged.`}
      onClose={onClose}
      className="w-[52rem]"
      footer={text ? <CopyButton text={text} label="Copy all" showLabel className="mr-auto" /> : undefined}
    >
      {isError && <InlineError>{error.message}</InlineError>}
      {lines && lines.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing logged yet. Start the model to see its activity.
        </p>
      )}
      {lines && lines.length > 0 && (
        <pre
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stuckRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
          }}
          className="selectable h-[26rem] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]"
        >
          {text}
        </pre>
      )}
    </Dialog>
  );
}
