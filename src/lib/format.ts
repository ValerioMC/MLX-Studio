export function bytes(n: number | null | undefined): string {
  if (n == null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function speed(bps: number | null | undefined): string {
  if (!bps) return "—";
  return `${bytes(bps)}/s`;
}

export function params(b: number | null | undefined): string {
  if (b == null) return "—";
  return b >= 1 ? `${b}B` : `${Math.round(b * 1000)}M`;
}

export function percent(used: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}
