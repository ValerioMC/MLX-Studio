import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pause, Play, RotateCw, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { bytes, eta, percent, speed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLive } from "@/stores/live";
import { useStartDownload } from "@/routes/catalog/DownloadButton";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Button, EmptyState, PageHeader, StatusDot } from "@/components/ui/primitives";
import type { DownloadJob, DownloadStatus } from "@/types";

const ORDER: Record<DownloadStatus, number> = {
  downloading: 0,
  queued: 1,
  paused: 2,
  failed: 3,
  completed: 4,
  canceled: 5,
};

function repoName(repoId: string): string {
  return repoId.split("/").pop()?.replace(/-/g, " ") ?? repoId;
}

function statusLine(job: DownloadJob): string {
  const total = job.total_bytes || 0;
  switch (job.status) {
    case "queued":
      return "Waiting to start";
    case "downloading": {
      if (!total) return "Reading the file list…";
      const left = eta(total - job.downloaded_bytes, job.speed_bps);
      return [speed(job.speed_bps), left].filter((part) => part && part !== "—").join(", ") || "Starting…";
    }
    case "paused":
      return "Paused";
    case "failed":
      return job.error ?? "Download failed";
    case "completed":
      return "Installed";
    case "canceled":
      return "Canceled";
  }
}

const BAR_COLOR: Record<DownloadStatus, string> = {
  downloading: "bg-accent",
  queued: "bg-accent",
  paused: "bg-muted-foreground",
  failed: "bg-destructive",
  completed: "bg-positive",
  canceled: "bg-muted-foreground",
};

export function DownloadsView() {
  const navigate = useNavigate();
  const downloads = useLive((s) => s.downloads);
  const dropDownload = useLive((s) => s.dropDownload);
  const retry = useStartDownload();
  const [cancelTarget, setCancelTarget] = useState<DownloadJob | null>(null);

  const jobs = Object.values(downloads).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const finished = jobs.filter((j) => j.status === "completed");

  // Dropping a finished job from the list never touches the installed model.
  const dismiss = (id: string) => {
    dropDownload(id);
    void api(`/downloads/${id}`, { method: "DELETE" }).catch(() => undefined);
  };
  const control = (id: string, action: "pause" | "resume") =>
    void api(`/downloads/${id}/${action}`, { method: "POST" }).catch(() => undefined);

  return (
    <div>
      <PageHeader title="Downloads">
        {finished.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => finished.forEach((j) => dismiss(j.id))}>
            Clear finished
          </Button>
        )}
      </PageHeader>

      {jobs.length === 0 ? (
        <EmptyState title="No downloads" action={<Button onClick={() => navigate("/catalog")}>Browse the catalog</Button>}>
          Downloads resume where they stopped if you pause them or quit the app mid-file.
        </EmptyState>
      ) : (
        <ul className="divide-y border-y">
          {jobs.map((job) => {
            const total = job.total_bytes || 0;
            const done = job.status === "completed" ? 100 : percent(job.downloaded_bytes, total || 1);
            return (
              <li key={job.id} className="flex flex-col gap-2.5 py-4">
                <div className="flex items-center gap-3">
                  <StatusDot
                    tone={
                      job.status === "failed"
                        ? "danger"
                        : job.status === "completed"
                          ? "positive"
                          : job.status === "paused"
                            ? "idle"
                            : "accent"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-md font-medium">{repoName(job.hf_repo_id)}</p>
                    <p className="selectable truncate font-mono text-xs text-muted-foreground">{job.hf_repo_id}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {job.status === "downloading" && (
                      <Button variant="ghost" size="icon" aria-label="Pause" title="Pause" onClick={() => control(job.id, "pause")}>
                        <Pause />
                      </Button>
                    )}
                    {job.status === "paused" && (
                      <Button variant="ghost" size="icon" aria-label="Resume" title="Resume" onClick={() => control(job.id, "resume")}>
                        <Play />
                      </Button>
                    )}
                    {job.status === "failed" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={retry.isPending && retry.variables === job.hf_repo_id}
                        onClick={() => {
                          dismiss(job.id);
                          retry.mutate(job.hf_repo_id);
                        }}
                      >
                        <RotateCw />
                        Retry
                      </Button>
                    )}
                    {job.status === "completed" && (
                      <Button variant="secondary" size="sm" onClick={() => navigate("/models")}>
                        <Play />
                        Start
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={job.status === "completed" || job.status === "failed" ? "Remove from list" : "Cancel download"}
                      title={job.status === "completed" || job.status === "failed" ? "Remove from list" : "Cancel"}
                      onClick={() =>
                        job.status === "completed" || job.status === "failed" ? dismiss(job.id) : setCancelTarget(job)
                      }
                    >
                      <X />
                    </Button>
                  </div>
                </div>
                <div className="pl-[19px]">
                  <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-500 ease-out", BAR_COLOR[job.status])}
                      style={{ width: `${done}%` }}
                    />
                  </div>
                  <div className="flex justify-between gap-4 pt-1.5 text-sm">
                    <span className={cn("min-w-0 truncate", job.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
                      {statusLine(job)}
                    </span>
                    <span className="tabular shrink-0 text-muted-foreground">
                      {total ? `${bytes(job.downloaded_bytes)} of ${bytes(total)}` : bytes(job.downloaded_bytes)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel this download?"
          confirmLabel="Cancel download"
          onCancel={() => setCancelTarget(null)}
          onConfirm={() => {
            dismiss(cancelTarget.id);
            setCancelTarget(null);
          }}
        >
          The {bytes(cancelTarget.downloaded_bytes)} downloaded so far will be deleted. Pause instead to finish it later.
        </ConfirmDialog>
      )}
    </div>
  );
}
