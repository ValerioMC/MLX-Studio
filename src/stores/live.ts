import { create } from "zustand";
import { subscribeSSE } from "@/lib/sse";
import { queryClient, queryKeys } from "@/lib/api/queries";
import type { DownloadJob, SystemStats } from "@/types";

/**
 * State the sidecar pushes over SSE: system stats (~1 Hz) and download
 * progress. One subscription each for the whole app, opened by the shell, so
 * the sidebar, pages and dialogs all read the same numbers.
 */
interface LiveState {
  stats: SystemStats | null;
  /** Download jobs by id, in the order they were first seen. */
  downloads: Record<string, DownloadJob>;
  dropDownload: (id: string) => void;
}

export const useLive = create<LiveState>((set) => ({
  stats: null,
  downloads: {},
  dropDownload: (id) =>
    set((state) => {
      const { [id]: _dropped, ...rest } = state.downloads;
      return { downloads: rest };
    }),
}));

function receiveJob(job: DownloadJob): void {
  const previous = useLive.getState().downloads[job.id];
  if (job.status === "canceled") {
    useLive.getState().dropDownload(job.id);
    return;
  }
  useLive.setState((state) => ({ downloads: { ...state.downloads, [job.id]: job } }));
  // A finished download is a new installed model.
  if (job.status === "completed" && previous?.status !== "completed") {
    void queryClient.invalidateQueries({ queryKey: queryKeys.models });
    void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
  }
}

/** Opens both feeds; returns the function that closes them. */
export function startLiveFeeds(): () => void {
  const stopStats = subscribeSSE<SystemStats>("/system/stats/stream", (stats) => useLive.setState({ stats }));
  const stopDownloads = subscribeSSE<DownloadJob>("/downloads/stream", receiveJob);
  return () => {
    stopStats();
    stopDownloads();
  };
}

/** The unfinished or failed job for a repo, if any. */
export function jobForRepo(downloads: Record<string, DownloadJob>, repoId: string): DownloadJob | undefined {
  return Object.values(downloads).find((j) => j.hf_repo_id === repoId && j.status !== "completed");
}

export function activeDownloadCount(downloads: Record<string, DownloadJob>): number {
  return Object.values(downloads).filter((j) => j.status === "downloading" || j.status === "queued").length;
}
