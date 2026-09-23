import { useMemo } from "react";
import { memoryLedger, type MemoryLedger, type PendingModel } from "@/lib/memory";
import { useModels } from "@/lib/api/queries";
import { useLive } from "@/stores/live";

/** The live memory ledger, with loaded models named; null until stats arrive. */
export function useMemoryLedger(pending?: PendingModel): MemoryLedger | null {
  const stats = useLive((s) => s.stats);
  const { data: models } = useModels();
  const pendingLabel = pending?.label;
  const pendingBytes = pending?.bytes;

  return useMemo(() => {
    if (!stats) return null;
    const names = new Map((models ?? []).map((m) => [m.id, m.display_name]));
    const nextPending =
      pendingLabel !== undefined && pendingBytes !== undefined ? { label: pendingLabel, bytes: pendingBytes } : undefined;
    return memoryLedger(stats, (id) => names.get(id) ?? id, nextPending);
  }, [stats, models, pendingLabel, pendingBytes]);
}
