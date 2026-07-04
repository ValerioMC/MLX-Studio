import { useEffect, useState } from "react";
import { subscribeSSE } from "@/lib/sse";
import { api } from "@/lib/api/client";
import { Button, Card } from "@/components/ui/primitives";
import { bytes, speed, percent } from "@/lib/format";
import type { DownloadJob } from "@/types";
import { Pause, Play, X } from "lucide-react";

export function DownloadsView() {
  const [jobs, setJobs] = useState<Record<string, DownloadJob>>({});

  useEffect(
    () =>
      subscribeSSE<DownloadJob>("/downloads/stream", (job) =>
        setJobs((prev) => {
          if (job.status === "canceled") {
            const next = { ...prev };
            delete next[job.id];
            return next;
          }
          return { ...prev, [job.id]: job };
        }),
      ),
    [],
  );

  const list = Object.values(jobs);
  const ctl = (id: string, action: "pause" | "resume" | "cancel") => {
    if (action === "cancel") {
      setJobs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return api(`/downloads/${id}`, { method: "DELETE" });
    }
    return api(`/downloads/${id}/${action}`, { method: "POST" });
  };

  return (
    <div className="animate-fade-in space-y-5 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Downloads</h1>
        <p className="text-sm text-muted-foreground">Resumable model downloads.</p>
      </header>

      {list.length === 0 ? (
        <Card className="text-sm text-muted-foreground">No downloads in progress.</Card>
      ) : (
        <div className="space-y-3">
          {list.map((j) => {
            const pct = percent(j.downloaded_bytes, j.total_bytes || j.downloaded_bytes || 1);
            return (
              <Card key={j.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{j.hf_repo_id}</p>
                    <p className="text-xs capitalize text-muted-foreground">{j.status}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {j.status === "downloading" && (
                      <Button variant="ghost" size="icon" onClick={() => ctl(j.id, "pause")}>
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    {j.status === "paused" && (
                      <Button variant="ghost" size="icon" onClick={() => ctl(j.id, "resume")}>
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => ctl(j.id, "cancel")}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {bytes(j.downloaded_bytes)} / {bytes(j.total_bytes)}
                  </span>
                  <span>{speed(j.speed_bps)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
