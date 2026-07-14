import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { ConnectDialog } from "@/components/models/ConnectDialog";
import { bytes, params } from "@/lib/format";
import type { Model } from "@/types";
import { Play, Square, Trash2, RefreshCw, Loader2, Code2 } from "lucide-react";

interface Estimate {
  context_length: number;
  est_ram_bytes: number | null;
  weight_bytes?: number;
  kv_cache_bytes?: number;
  overhead_bytes?: number;
  fit: "fits" | "tight" | "too_big" | "unknown";
  budget_bytes: number;
  total_usable_bytes: number;
  max_context?: number | null;
}

export function ModelsView() {
  const qc = useQueryClient();
  const [startTarget, setStartTarget] = useState<Model | null>(null);
  const [connectTarget, setConnectTarget] = useState<Model | null>(null);
  const { data: models } = useQuery({
    queryKey: ["models"],
    queryFn: () => api<Model[]>("/models"),
    refetchInterval: 3000,
  });

  const action = useMutation({
    mutationFn: ({ id, verb, body }: { id: string; verb: string; body?: object }) =>
      verb === "delete"
        ? api(`/models/${id}`, { method: "DELETE" })
        : api(`/models/${id}/${verb}`, { method: "POST", body: JSON.stringify(body ?? {}) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["models"] });
      // The moment a model comes up is when "how do I call it from my code?"
      // gets asked; answer it right away with the connection snippets.
      if (vars.verb === "start" && startTarget) {
        setConnectTarget({ ...startTarget, status: "running" });
      }
    },
    onSettled: () => setStartTarget(null),
  });

  return (
    <div className="animate-fade-in space-y-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Models</h1>
        <p className="text-sm text-muted-foreground">Manage installed models.</p>
      </header>

      {action.isError && (
        <Card className="border-destructive/40 text-sm text-destructive">
          {(action.error as Error)?.message || "Action failed."}
        </Card>
      )}

      {!models?.length ? (
        <Card className="text-sm text-muted-foreground">
          No models installed yet. Visit the Catalog to download one.
        </Card>
      ) : (
        <div className="space-y-3">
          {models.map((m) => {
            const running = m.status === "running";
            const chatCapable = m.chat_capable !== false;
            return (
              <Card key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.display_name}</span>
                      {running ? <Badge tone="green">running</Badge> : <Badge>installed</Badge>}
                      {!chatCapable && (
                        <Badge tone="amber" title="Not a text-generation model; chat can't use it">
                          not chat-capable
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Badge>{params(m.params_b)}</Badge>
                      {m.quantization && <Badge>{m.quantization}</Badge>}
                      <Badge>{bytes(m.download_bytes)}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {chatCapable &&
                    (running ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={action.isPending}
                        onClick={() => action.mutate({ id: m.id, verb: "stop" })}
                      >
                        <Square className="h-4 w-4" /> Stop
                      </Button>
                    ) : (
                      <Button size="sm" disabled={action.isPending} onClick={() => setStartTarget(m)}>
                        <Play className="h-4 w-4" /> Start
                      </Button>
                    ))}
                  {chatCapable && (
                    <Button
                      variant="secondary"
                      size="sm"
                      title="Base URL, API key, and code snippets for this model"
                      onClick={() => setConnectTarget(m)}
                    >
                      <Code2 className="h-4 w-4" /> Connect
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={action.isPending}
                    onClick={() => action.mutate({ id: m.id, verb: "update" })}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={action.isPending}
                    onClick={() => {
                      if (confirm(`Delete ${m.display_name}? This removes the weights from disk.`))
                        action.mutate({ id: m.id, verb: "delete" });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {connectTarget && (
        <ConnectDialog model={connectTarget} onClose={() => setConnectTarget(null)} />
      )}

      {startTarget && !action.isPending && (
        <StartDialog
          model={startTarget}
          onCancel={() => setStartTarget(null)}
          onStart={(context_length, enable_thinking) => {
            action.mutate({
              id: startTarget.id,
              verb: "start",
              body: { context_length, enable_thinking },
            });
          }}
        />
      )}

      {action.isPending && action.variables?.verb === "start" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="flex items-center gap-3 shadow-glow">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <div>
              <p className="text-sm font-medium">Starting {startTarget?.display_name}…</p>
              <p className="text-xs text-muted-foreground">
                Loading weights into memory. Large models can take a while.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

const FIT_LABEL: Record<Estimate["fit"], { text: string; tone: "green" | "amber" | "red" | "muted" }> = {
  fits: { text: "Fits", tone: "green" },
  tight: { text: "Tight", tone: "amber" },
  too_big: { text: "Too big", tone: "red" },
  unknown: { text: "Unknown", tone: "muted" },
};

function StartDialog({
  model,
  onCancel,
  onStart,
}: {
  model: Model;
  onCancel: () => void;
  onStart: (contextLength: number, enableThinking: boolean) => void;
}) {
  const [ctx, setCtx] = useState<number>(model.context_length || 4096);
  const [thinking, setThinking] = useState(true);
  const [est, setEst] = useState<Estimate | null>(null);
  const maxCtx = est?.max_context || model.context_length || 32768;

  // Debounced live estimate as the slider moves.
  useEffect(() => {
    const t = setTimeout(() => {
      api<Estimate>(`/models/${model.id}/estimate?context_length=${ctx}`)
        .then(setEst)
        .catch(() => setEst(null));
    }, 200);
    return () => clearTimeout(t);
  }, [ctx, model.id]);

  const fit = est ? FIT_LABEL[est.fit] : FIT_LABEL.unknown;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <Card
        className="w-[28rem] max-w-[90vw] space-y-4 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold">Start {model.display_name}</h2>
          <p className="text-xs text-muted-foreground">
            Larger context lets the model see more text at once, but uses more memory.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Context length</span>
            <span className="font-mono">{ctx.toLocaleString()} tokens</span>
          </div>
          <input
            type="range"
            min={1024}
            max={maxCtx}
            step={1024}
            value={Math.min(ctx, maxCtx)}
            onChange={(e) => setCtx(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1K</span>
            <span>{Math.round(maxCtx / 1024)}K max</span>
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Estimated memory</span>
            <span className="flex items-center gap-2">
              <span className="font-mono font-medium">
                {est?.est_ram_bytes != null ? bytes(est.est_ram_bytes) : "—"}
              </span>
              <Badge tone={fit.tone}>{fit.text}</Badge>
            </span>
          </div>
          {est?.est_ram_bytes != null && (
            <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>Weights</dt>
                <dd className="font-mono">{bytes(est.weight_bytes)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>KV cache (grows with context)</dt>
                <dd className="font-mono">{bytes(est.kv_cache_bytes)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Overhead</dt>
                <dd className="font-mono">{bytes(est.overhead_bytes)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1">
                <dt>Free right now</dt>
                <dd className="font-mono">{bytes(est.budget_bytes)}</dd>
              </div>
            </dl>
          )}
        </div>

        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="block">Reasoning (thinking)</span>
            <span className="text-xs text-muted-foreground">
              Off = direct answers, no &lt;think&gt; block (Qwen3 etc.)
            </span>
          </span>
          <input
            type="checkbox"
            checked={thinking}
            onChange={(e) => setThinking(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
        </label>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={est?.fit === "too_big"} onClick={() => onStart(ctx, thinking)}>
            <Play className="h-4 w-4" /> Start
          </Button>
        </div>
      </Card>
    </div>
  );
}
