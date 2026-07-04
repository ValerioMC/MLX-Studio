import { Card } from "@/components/ui/primitives";
import { MemoryGauge } from "@/components/system/MemoryGauge";
import { useSystemStats } from "@/hooks/useSystemStats";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Activity, Model } from "@/types";
import { Boxes, Cpu, Activity as ActivityIcon } from "lucide-react";

export function DashboardView() {
  const stats = useSystemStats();
  const { data: models } = useQuery({ queryKey: ["models"], queryFn: () => api<Model[]>("/models") });
  const { data: activity } = useQuery({
    queryKey: ["activity"],
    queryFn: () => api<{ items: Activity[] }>("/system/activity"),
    refetchInterval: 5000,
  });

  const installed = models?.length ?? 0;
  const running = models?.filter((m) => m.status === "running").length ?? 0;

  return (
    <div className="animate-fade-in space-y-6 pt-2">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Local AI at a glance.</p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Stat icon={Boxes} label="Installed models" value={installed} />
        <Stat icon={Cpu} label="Running" value={running} />
        <Stat
          icon={ActivityIcon}
          label="CPU"
          value={stats ? `${Math.round(stats.cpu_percent)}%` : "—"}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Memory usage</h2>
          <MemoryGauge stats={stats} />
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-semibold">Recent activity</h2>
          <div className="space-y-2">
            {activity?.items.length ? (
              activity.items.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="text-muted-foreground">{a.message}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent/15 text-accent">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}
