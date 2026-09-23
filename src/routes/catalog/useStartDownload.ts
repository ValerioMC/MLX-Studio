import { useMutation } from "@tanstack/vue-query";
import { api } from "@/lib/api/client";
import { useLive } from "@/stores/live";
import type { DownloadJob } from "@/types";

export function useStartDownload() {
  const live = useLive();
  return useMutation({
    mutationFn: (repoId: string) =>
      api<DownloadJob>("/downloads", { method: "POST", body: JSON.stringify({ repo_id: repoId }) }),
    // Show the job at once; the progress feed takes over from here.
    onSuccess: (job) => {
      live.downloads = { ...live.downloads, [job.id]: job };
    },
  });
}
