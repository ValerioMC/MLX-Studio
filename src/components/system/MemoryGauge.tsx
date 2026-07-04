import { bytes, percent } from "@/lib/format";
import type { SystemStats } from "@/types";

export function MemoryGauge({ stats }: { stats?: SystemStats }) {
  if (!stats) return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  const used = percent(stats.ram_used, stats.ram_total);
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (used / 100) * c;

  return (
    <div className="flex items-center gap-5">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" strokeWidth="10" className="stroke-muted" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="stroke-accent transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold">{used}%</span>
          <span className="text-xs text-muted-foreground">memory</span>
        </div>
      </div>
      <div className="space-y-1 text-sm">
        <Row label="Used" value={bytes(stats.ram_used)} />
        <Row label="Available" value={bytes(stats.ram_available)} />
        <Row label="Total" value={bytes(stats.ram_total)} />
        {stats.swap_used > 0 && (
          <Row label="Swap" value={bytes(stats.swap_used)} warn />
        )}
      </div>
    </div>
  );
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-muted-foreground">{label}</span>
      <span className={warn ? "font-medium text-destructive" : "font-medium"}>{value}</span>
    </div>
  );
}
