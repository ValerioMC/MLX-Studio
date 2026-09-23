import { computed, type ComputedRef } from "vue";
import { memoryLedger, type MemoryLedger, type PendingModel } from "@/lib/memory";
import { useModels } from "@/lib/api/queries";
import { useLive } from "@/stores/live";

/** The live memory ledger, with loaded models named; null until stats arrive. */
export function useMemoryLedger(pending?: () => PendingModel | undefined): ComputedRef<MemoryLedger | null> {
  const live = useLive();
  const { data: models } = useModels();

  return computed(() => {
    const stats = live.stats;
    if (!stats) return null;
    const names = new Map((models.value ?? []).map((m) => [m.id, m.display_name]));
    return memoryLedger(stats, (id) => names.get(id) ?? id, pending?.());
  });
}
