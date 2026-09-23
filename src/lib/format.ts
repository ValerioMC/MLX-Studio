const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function bytes(n: number | null | undefined): string {
  if (n == null) return "—";
  let i = 0;
  let v = n;
  while (v >= 1024 && i < BYTE_UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${BYTE_UNITS[i]}`;
}

/** Gigabytes as a bare number ("12.4"), for figures that print the unit apart. */
export function gigabytes(n: number): string {
  const gb = n / 1024 ** 3;
  return gb < 10 ? gb.toFixed(1) : Math.round(gb).toString();
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

/** 1234 → "1.2K", 2_500_000 → "2.5M". */
export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Context sizes in the unit people quote them in: 4096 → "4K", 131072 → "128K". */
export function contextSize(tokens: number): string {
  return tokens >= 1024 ? `${Math.round(tokens / 1024)}K` : `${tokens}`;
}

/** Remaining time for a transfer, or null when it cannot be estimated. */
export function eta(remainingBytes: number, bytesPerSecond: number | null | undefined): string | null {
  if (!bytesPerSecond || bytesPerSecond <= 0 || remainingBytes <= 0) return null;
  const seconds = remainingBytes / bytesPerSecond;
  if (seconds < 60) return "under a minute left";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `about ${hours} h ${rest} min left` : `about ${hours} h left`;
}
