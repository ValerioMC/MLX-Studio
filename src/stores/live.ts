import { defineStore } from "pinia";
import { ref } from "vue";
import { subscribeSSE } from "@/lib/sse";
import { queryClient, queryKeys } from "@/lib/api/queries";
import type { DownloadJob, SystemStats } from "@/types";

/**
 * State the sidecar pushes over SSE: system stats (~1 Hz) and download
 * progress. One subscription each for the whole app, opened by the shell, so
 * the sidebar, pages and dialogs all read the same numbers.
 */
export const useLive = defineStore("live", () => {
  const stats = ref<SystemStats | null>(null);
  /** Download jobs by id, in the order they were first seen. */
  const downloads = ref<Record<string, DownloadJob>>({});

  function dropDownload(id: string): void {
    const { [id]: _dropped, ...rest } = downloads.value;
    downloads.value = rest;
  }

  function receiveJob(job: DownloadJob): void {
    const previous = downloads.value[job.id];
    if (job.status === "canceled") {
      dropDownload(job.id);
      return;
    }
    downloads.value = { ...downloads.value, [job.id]: job };
    // A finished download is a new installed model.
    if (job.status === "completed" && previous?.status !== "completed") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.models });
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
    }
  }

  /** Opens both feeds; returns the function that closes them. */
  function startFeeds(): () => void {
    const stopStats = subscribeSSE<SystemStats>("/system/stats/stream", (next) => {
      stats.value = next;
    });
    const stopDownloads = subscribeSSE<DownloadJob>("/downloads/stream", receiveJob);
    return () => {
      stopStats();
      stopDownloads();
    };
  }

  return { stats, downloads, dropDownload, startFeeds };
});

/** The unfinished or failed job for a repo, if any. */
export function jobForRepo(downloads: Record<string, DownloadJob>, repoId: string): DownloadJob | undefined {
  return Object.values(downloads).find((j) => j.hf_repo_id === repoId && j.status !== "completed");
}

export function activeDownloadCount(downloads: Record<string, DownloadJob>): number {
  return Object.values(downloads).filter((j) => j.status === "downloading" || j.status === "queued").length;
}
