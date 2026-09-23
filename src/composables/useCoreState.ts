import { computed } from "vue";
import { useMutationState } from "@tanstack/vue-query";
import { modelMutationKey } from "@/components/models/useModelActions";
import type { CoreState } from "@/components/instruments/ModelCore.vue";
import { useChat } from "@/stores/chat";
import { useLive } from "@/stores/live";
import type { Model } from "@/types";

/**
 * What ModelCore should show for a model, and in which color, from everything
 * the app knows: its status, a start or stop in flight (from the mutation
 * cache, wherever it was started), and whether Chat is streaming from it.
 */
export function useCoreState() {
  const chat = useChat();
  const live = useLive();
  const pendingIds = (verb: "start" | "stop") =>
    useMutationState({
      filters: { mutationKey: modelMutationKey(verb), status: "pending" },
      select: (mutation) => mutation.state.variables as string | undefined,
    });
  const starting = pendingIds("start");
  const stopping = pendingIds("stop");
  const tones = computed(() => new Map(live.stats?.loaded_models.map((m) => [m.model_id, m.tone ?? 0]) ?? []));

  function stateOf(model: Pick<Model, "id" | "status">): CoreState {
    if (stopping.value.includes(model.id)) return "stopping";
    if (starting.value.includes(model.id)) return "loading";
    if (model.status === "error") return "error";
    if (model.status !== "running") return "idle";
    return chat.busy && chat.model === model.id ? "generating" : "running";
  }

  function toneOf(model: Pick<Model, "id">): number {
    return tones.value.get(model.id) ?? 0;
  }

  return { stateOf, toneOf };
}
