import { useEffect, useState } from "react";
import { subscribeSSE } from "@/lib/sse";
import type { SystemStats } from "@/types";

/** Live system stats via SSE (~1 Hz). */
export function useSystemStats() {
  const [stats, setStats] = useState<SystemStats>();
  useEffect(() => subscribeSSE<SystemStats>("/system/stats/stream", setStats), []);
  return stats;
}
