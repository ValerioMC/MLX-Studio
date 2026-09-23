import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Code2, MessageSquare, Play, RefreshCw, ScrollText, Square, Trash2 } from "lucide-react";
import { useModels } from "@/lib/api/queries";
import { jobForRepo, useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import { StartModelDialog } from "@/components/models/StartModelDialog";
import { ConnectDialog } from "@/components/models/ConnectDialog";
import { ModelLogsDialog } from "@/components/models/ModelLogsDialog";
import { ModelFacts } from "@/components/models/ModelFacts";
import { useModelAction } from "@/components/models/useModelActions";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Button, EmptyState, InlineError, PageHeader, StatusDot, Tag } from "@/components/ui/primitives";
import { bytes, percent } from "@/lib/format";
import type { Model } from "@/types";

function byStatusThenName(a: Model, b: Model): number {
  const running = Number(b.status === "running") - Number(a.status === "running");
  return running || a.display_name.localeCompare(b.display_name);
}

export function ModelsView() {
  const navigate = useNavigate();
  const { data: models, isLoading } = useModels();
  const downloads = useLive((s) => s.downloads);
  const setChatModel = useChat((s) => s.setModel);
  const stop = useModelAction("stop");
  const update = useModelAction("update");
  const remove = useModelAction("delete");
  const [startTarget, setStartTarget] = useState<Model | null>(null);
  const [connectTarget, setConnectTarget] = useState<Model | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Model | null>(null);
  const [logsTarget, setLogsTarget] = useState<Model | null>(null);

  const sorted = [...(models ?? [])].sort(byStatusThenName);
  const totalOnDisk = sorted.reduce((sum, m) => sum + (m.download_bytes ?? 0), 0);
  const actionError = stop.error ?? update.error;

  const openChat = (model: Model) => {
    setChatModel(model.id);
    navigate("/chat");
  };

  return (
    <div>
      <PageHeader title="Models">
        {sorted.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {sorted.length} installed, <span className="tabular">{bytes(totalOnDisk)}</span> on disk
          </span>
        )}
      </PageHeader>

      {actionError && <InlineError className="mb-4">{actionError.message}</InlineError>}

      {!isLoading && sorted.length === 0 && (
        <EmptyState
          title="No models installed"
          action={<Button onClick={() => navigate("/catalog")}>Browse the catalog</Button>}
        >
          Models you download from the catalog land here, ready to start.
        </EmptyState>
      )}

      {sorted.length > 0 && (
        <ul className="divide-y border-y">
          {sorted.map((m) => {
            const running = m.status === "running";
            const chatCapable = m.chat_capable !== false;
            const job = jobForRepo(downloads, m.hf_repo_id);
            const updating = job && job.status !== "failed";
            const stopping = stop.isPending && stop.variables === m.id;
            return (
              <li key={m.id} className="flex items-center gap-4 py-3.5">
                <StatusDot tone={running ? "positive" : "idle"} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-md font-medium">{m.display_name}</p>
                    {!chatCapable && (
                      <Tag tone="caution" title="Not a text-generation model, so chat and the API can't use it">
                        Not a chat model
                      </Tag>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted-foreground">
                    <span className="selectable truncate font-mono text-xs">{m.hf_repo_id}</span>
                    <ModelFacts model={m} />
                    <span className="tabular">{bytes(m.download_bytes)}</span>
                    {updating && (
                      <span className="tabular text-accent">
                        Updating {percent(job.downloaded_bytes, job.total_bytes || 1)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {chatCapable && running && (
                    <>
                      <Button size="sm" onClick={() => openChat(m)}>
                        <MessageSquare />
                        Chat
                      </Button>
                      <Button variant="secondary" size="sm" loading={stopping} onClick={() => stop.mutate(m.id)}>
                        {!stopping && <Square className="fill-current" />}
                        Stop
                      </Button>
                    </>
                  )}
                  {chatCapable && !running && (
                    <Button variant="secondary" size="sm" onClick={() => setStartTarget(m)}>
                      <Play />
                      Start
                    </Button>
                  )}
                  {chatCapable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Use from code"
                      aria-label={`Use ${m.display_name} from code`}
                      onClick={() => setConnectTarget(m)}
                    >
                      <Code2 />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Logs"
                    aria-label={`${m.display_name} logs`}
                    onClick={() => setLogsTarget(m)}
                  >
                    <ScrollText />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={updating ? "Updating" : "Check for updates"}
                    aria-label={`Check ${m.display_name} for updates`}
                    disabled={Boolean(updating)}
                    loading={update.isPending && update.variables === m.id}
                    onClick={() => update.mutate(m.id)}
                  >
                    {!(update.isPending && update.variables === m.id) && <RefreshCw />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete"
                    aria-label={`Delete ${m.display_name}`}
                    className="hover:text-destructive"
                    onClick={() => setDeleteTarget(m)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {startTarget && (
        <StartModelDialog
          model={startTarget}
          onClose={() => setStartTarget(null)}
          onStarted={(m) => {
            setStartTarget(null);
            // The moment a model comes up is when "how do I call it from my
            // code?" gets asked; answer it right away.
            setConnectTarget(m);
          }}
        />
      )}
      {connectTarget && <ConnectDialog model={connectTarget} onClose={() => setConnectTarget(null)} />}
      {logsTarget && <ModelLogsDialog model={logsTarget} onClose={() => setLogsTarget(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.display_name}?`}
          confirmLabel="Delete"
          busy={remove.isPending}
          onCancel={() => {
            remove.reset();
            setDeleteTarget(null);
          }}
          onConfirm={() =>
            remove.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            })
          }
        >
          <p>
            This removes <span className="tabular font-medium text-foreground">{bytes(deleteTarget.download_bytes)}</span>{" "}
            of weights from disk. You can download it again from the catalog.
          </p>
          {remove.isError && <InlineError className="mt-3">{remove.error.message}</InlineError>}
        </ConfirmDialog>
      )}
    </div>
  );
}
