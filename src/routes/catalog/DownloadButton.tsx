import { useMutation } from "@tanstack/react-query";
import { Check, Download, RotateCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api/client";
import { useModels } from "@/lib/api/queries";
import { jobForRepo, useLive } from "@/stores/live";
import { Button } from "@/components/ui/primitives";
import { percent } from "@/lib/format";
import type { DownloadJob } from "@/types";

export function useStartDownload() {
  return useMutation({
    mutationFn: (repoId: string) =>
      api<DownloadJob>("/downloads", { method: "POST", body: JSON.stringify({ repo_id: repoId }) }),
    // Show the job at once; the progress feed takes over from here.
    onSuccess: (job) => useLive.setState((s) => ({ downloads: { ...s.downloads, [job.id]: job } })),
  });
}

/** Download, or where the download of this repo stands. */
export function DownloadButton({ repoId, quiet = false }: { repoId: string; quiet?: boolean }) {
  const navigate = useNavigate();
  const { data: models } = useModels();
  const job = useLive((s) => jobForRepo(s.downloads, repoId));
  const start = useStartDownload();

  if (models?.some((m) => m.hf_repo_id === repoId)) {
    return (
      <Button variant="ghost" size="sm" onClick={() => navigate("/models")} className="text-positive hover:text-positive">
        <Check />
        Installed
      </Button>
    );
  }

  if (job && job.status !== "failed") {
    const label =
      job.status === "paused" ? "Paused" : `${percent(job.downloaded_bytes, job.total_bytes || 1)}%`;
    return (
      <Button variant="secondary" size="sm" onClick={() => navigate("/downloads")} className="tabular min-w-[6.5rem]">
        {job.status === "paused" ? label : `Downloading ${label}`}
      </Button>
    );
  }

  const failed = job?.status === "failed" || start.isError;
  return (
    <Button
      variant={failed || quiet ? "secondary" : "primary"}
      size="sm"
      loading={start.isPending}
      title={start.error?.message ?? job?.error ?? undefined}
      onClick={() => start.mutate(repoId)}
      className="min-w-[6.5rem]"
    >
      {!start.isPending && (failed ? <RotateCw /> : <Download />)}
      {failed ? "Retry" : "Download"}
    </Button>
  );
}
