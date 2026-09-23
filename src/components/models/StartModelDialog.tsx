import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { api } from "@/lib/api/client";
import { fetchEstimate, queryClient, queryKeys } from "@/lib/api/queries";
import { bytes, contextSize } from "@/lib/format";
import { useMemoryLedger } from "@/hooks/useMemoryLedger";
import { Dialog } from "@/components/ui/Dialog";
import { Slider, Switch } from "@/components/ui/controls";
import { Button, InlineError } from "@/components/ui/primitives";
import { LedgerBar } from "@/components/system/MemoryLedger";
import type { Fit, Model } from "@/types";

const MIN_CONTEXT = 1024;
const CONTEXT_STEP = 1024;
const FALLBACK_MAX_CONTEXT = 32768;
const DEFAULT_CONTEXT = 8192;
const ESTIMATE_DEBOUNCE_MS = 180;

const FIT_MESSAGE: Record<Fit, { text: string; className: string }> = {
  fits: { text: "Fits in free memory.", className: "text-positive" },
  tight: {
    text: "More than is free right now. macOS will reclaim cached memory to make room, which can slow other apps.",
    className: "text-caution",
  },
  too_big: { text: "Too big for this Mac at this context length. Lower it to start.", className: "text-destructive" },
  unknown: { text: "Could not estimate this model's memory. It may still start.", className: "text-muted-foreground" },
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Pick a context length and see the memory it costs before loading. */
export function StartModelDialog({
  model,
  onClose,
  onStarted,
}: {
  model: Model;
  onClose: () => void;
  onStarted: (model: Model) => void;
}) {
  const [context, setContext] = useState(() => Math.min(model.context_length || DEFAULT_CONTEXT, DEFAULT_CONTEXT));
  const [thinking, setThinking] = useState(true);
  const debouncedContext = useDebounced(context, ESTIMATE_DEBOUNCE_MS);

  const { data: estimate } = useQuery({
    queryKey: queryKeys.estimate(model.id, debouncedContext),
    queryFn: () => fetchEstimate(model.id, debouncedContext),
    placeholderData: keepPreviousData,
  });

  const maxContext = Math.max(estimate?.max_context || model.context_length || FALLBACK_MAX_CONTEXT, MIN_CONTEXT);
  const needed = estimate?.est_ram_bytes ?? null;
  const ledger = useMemoryLedger(needed != null ? { label: model.display_name, bytes: needed } : undefined);
  const fit = FIT_MESSAGE[estimate?.fit ?? "unknown"];

  const start = useMutation({
    mutationFn: () =>
      api(`/models/${encodeURIComponent(model.id)}/start`, {
        method: "POST",
        body: JSON.stringify({ context_length: context, enable_thinking: thinking }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.models });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
      onStarted({ ...model, status: "running" });
    },
  });

  return (
    <Dialog
      title={`Start ${model.display_name}`}
      description="A longer context lets the model read more at once, and costs memory."
      onClose={onClose}
      dismissible={!start.isPending}
      className="w-[32rem]"
      footer={
        <>
          {start.isPending && (
            <span className="mr-auto text-sm text-muted-foreground">Loading weights into memory…</span>
          )}
          <Button variant="secondary" onClick={onClose} disabled={start.isPending}>
            Cancel
          </Button>
          <Button onClick={() => start.mutate()} loading={start.isPending} disabled={estimate?.fit === "too_big"}>
            {!start.isPending && <Play />}
            {start.isPending ? "Starting" : "Start"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="context-length" className="text-base font-medium">
              Context length
            </label>
            <span className="tabular text-base">
              {context.toLocaleString()} <span className="text-muted-foreground">tokens</span>
            </span>
          </div>
          <Slider
            label="Context length"
            min={MIN_CONTEXT}
            max={maxContext}
            step={CONTEXT_STEP}
            value={Math.min(context, maxContext)}
            onChange={setContext}
          />
          <div className="flex justify-between text-2xs tabular text-muted-foreground">
            <span>{contextSize(MIN_CONTEXT)}</span>
            <span>{contextSize(maxContext)} max</span>
          </div>
        </section>

        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-medium">Memory</h3>
            <span className="tabular text-base font-medium">{needed != null ? bytes(needed) : "—"}</span>
          </div>
          {ledger && <LedgerBar ledger={ledger} height="h-5" overflow={estimate?.fit === "too_big"} />}
          {estimate?.est_ram_bytes != null && (
            <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-0.5 text-sm text-muted-foreground">
              <dt>Weights</dt>
              <dd className="tabular text-right text-foreground">{bytes(estimate.weight_bytes)}</dd>
              <dt>KV cache at {contextSize(context)} context</dt>
              <dd className="tabular text-right text-foreground">{bytes(estimate.kv_cache_bytes)}</dd>
              <dt>Runtime overhead</dt>
              <dd className="tabular text-right text-foreground">{bytes(estimate.overhead_bytes)}</dd>
              <dt>Free for models now</dt>
              <dd className="tabular text-right text-foreground">{bytes(estimate.budget_bytes)}</dd>
            </dl>
          )}
          <p className={`text-sm ${fit.className}`}>{fit.text}</p>
        </section>

        <section className="flex items-start justify-between gap-6 border-t pt-4">
          <div>
            <p className="text-base font-medium">Reasoning</p>
            <p className="text-sm text-muted-foreground">
              Lets models that think first (Qwen3, DeepSeek-R1) do so. Off gives direct answers.
            </p>
          </div>
          <Switch label="Reasoning" checked={thinking} onChange={setThinking} />
        </section>

        {start.isError && <InlineError>{start.error.message}</InlineError>}
      </div>
    </Dialog>
  );
}
