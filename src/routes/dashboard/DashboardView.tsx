import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Code2, MessageSquare, Play, Square } from "lucide-react";
import { useActivity, useModels } from "@/lib/api/queries";
import { useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import { useMemoryLedger } from "@/hooks/useMemoryLedger";
import { FreeForModels, LedgerBar, LedgerLegend } from "@/components/system/MemoryLedger";
import { StartModelDialog } from "@/components/models/StartModelDialog";
import { ConnectDialog } from "@/components/models/ConnectDialog";
import { ModelFacts } from "@/components/models/ModelFacts";
import { useModelAction } from "@/components/models/useModelActions";
import { Button, EmptyState, PageHeader, StatusDot } from "@/components/ui/primitives";
import { bytes, contextSize } from "@/lib/format";
import { parseServerDate, relativeTime } from "@/lib/time";
import type { Model } from "@/types";

/** Swap above this means macOS is short on memory and generation will crawl. */
const SWAP_WARNING_BYTES = 1024 ** 3;
const QUICK_START_LIMIT = 4;

export function DashboardView() {
  const navigate = useNavigate();
  const stats = useLive((s) => s.stats);
  const ledger = useMemoryLedger();
  const { data: models, isLoading: modelsLoading } = useModels();
  const { data: activity } = useActivity();
  const setChatModel = useChat((s) => s.setModel);
  const stop = useModelAction("stop");
  const [startTarget, setStartTarget] = useState<Model | null>(null);
  const [connectTarget, setConnectTarget] = useState<Model | null>(null);

  const running = models?.filter((m) => m.status === "running") ?? [];
  const idle = models?.filter((m) => m.status !== "running" && m.chat_capable !== false) ?? [];
  const loaded = new Map(stats?.loaded_models.map((m) => [m.model_id, m]) ?? []);

  const openChat = (model: Model) => {
    setChatModel(model.id);
    navigate("/chat");
  };

  return (
    <div>
      <PageHeader title="Overview" />

      <section aria-label="Unified memory" className="flex flex-col gap-4 pb-10">
        {ledger && stats ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
              <FreeForModels ledger={ledger} />
              <dl className="flex gap-6 pb-1 text-sm">
                <div>
                  <dt className="text-muted-foreground">Disk free</dt>
                  <dd className="tabular font-medium">{bytes(stats.disk_free)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">CPU</dt>
                  <dd className="tabular font-medium">{Math.round(stats.cpu_percent)}%</dd>
                </div>
              </dl>
            </div>
            <LedgerBar ledger={ledger} height="h-9" className="rounded-[7px] p-[3px]" />
            <LedgerLegend ledger={ledger} />
            {stats.swap_used > SWAP_WARNING_BYTES && (
              <p className="text-sm text-caution">
                macOS is swapping {bytes(stats.swap_used)} to disk, so generation will be slow. Stop a model or start it
                with a shorter context.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4" aria-busy>
            <div className="h-[3.7rem] w-80 animate-pulse rounded-md bg-muted" />
            <div className="h-9 animate-pulse rounded-[7px] bg-muted" />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <section aria-labelledby="running-heading">
          <h2 id="running-heading" className="pb-2 text-md font-semibold">
            {running.length ? "Running" : "Start a model"}
          </h2>

          {running.length > 0 && (
            <ul className="divide-y border-y">
              {running.map((m) => {
                const info = loaded.get(m.id);
                return (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <StatusDot tone="positive" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-md font-medium">{m.display_name}</p>
                      <p className="flex items-center gap-2 pt-0.5 text-sm text-muted-foreground">
                        <ModelFacts model={m} />
                        {info && <span className="tabular">{contextSize(info.context_length)} context</span>}
                        {info?.est_ram_bytes != null && <span className="tabular">{bytes(info.est_ram_bytes)}</span>}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => openChat(m)}>
                      <MessageSquare />
                      Chat
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setConnectTarget(m)}>
                      <Code2 />
                      Use from code
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Stop ${m.display_name}`}
                      loading={stop.isPending && stop.variables === m.id}
                      onClick={() => stop.mutate(m.id)}
                    >
                      {!(stop.isPending && stop.variables === m.id) && <Square className="fill-current" />}
                      Stop
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {running.length === 0 && idle.length > 0 && (
            <ul className="divide-y border-y">
              {idle.slice(0, QUICK_START_LIMIT).map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <StatusDot tone="idle" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-md font-medium">{m.display_name}</p>
                    <p className="pt-0.5">
                      <ModelFacts model={m} />
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setStartTarget(m)}>
                    <Play />
                    Start
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {running.length === 0 && idle.length > QUICK_START_LIMIT && (
            <Link to="/models" className="mt-2 inline-block text-sm text-accent hover:underline">
              All {idle.length} installed models
            </Link>
          )}

          {!modelsLoading && models?.length === 0 && (
            <EmptyState
              title="No models yet"
              action={
                <Button onClick={() => navigate("/catalog")}>
                  Browse the catalog
                </Button>
              }
            >
              Download an MLX model from Hugging Face. Anything marked “Fits” runs well on this Mac.
            </EmptyState>
          )}
        </section>

        <section aria-labelledby="activity-heading">
          <h2 id="activity-heading" className="pb-2 text-md font-semibold">
            Activity
          </h2>
          {activity?.length ? (
            <ol className="flex flex-col">
              {activity.map((a, i) => {
                const at = parseServerDate(a.at);
                return (
                  <li key={`${a.at}-${i}`} className="grid grid-cols-[4.5rem_1fr] gap-3 py-1.5 text-sm">
                    <time dateTime={at.toISOString()} title={at.toLocaleString()} className="tabular text-muted-foreground">
                      {relativeTime(at)}
                    </time>
                    <span className="min-w-0 break-words">{a.message}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Downloads, starts and stops show up here.</p>
          )}
        </section>
      </div>

      {startTarget && (
        <StartModelDialog
          model={startTarget}
          onClose={() => setStartTarget(null)}
          onStarted={(m) => {
            setStartTarget(null);
            openChat(m);
          }}
        />
      )}
      {connectTarget && <ConnectDialog model={connectTarget} onClose={() => setConnectTarget(null)} />}
    </div>
  );
}
