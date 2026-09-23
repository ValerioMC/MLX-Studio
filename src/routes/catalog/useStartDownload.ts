import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { useLive } from "@/stores/live";
import type { DownloadJob } from "@/types";

export function useStartDownload() {
  return useMutation({
    mutationFn: (repoId: string) =>
      api<DownloadJob>("/downloads", { method: "POST", body: JSON.stringify({ repo_id: repoId }) }),
    // Show the job at once; the progress feed takes over from here.
    onSuccess: (job) => useLive.setState((s) => ({ downloads: { ...s.downloads, [job.id]: job } })),
  });
}
