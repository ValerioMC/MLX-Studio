import { useMutation } from "@tanstack/vue-query";
import { api } from "@/lib/api/client";
import { queryClient, queryKeys } from "@/lib/api/queries";
import { useToasts } from "@/stores/toast";

type Verb = "stop" | "update" | "delete";

/** Mutation keys, so any component can see which models are mid-start or mid-stop (see useCoreState). */
export const modelMutationKey = (verb: Verb | "start") => ["model", verb] as const;

function refresh(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.models });
  void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
}

const FAILURE: Record<Verb, string> = {
  stop: "Could not stop the model",
  update: "Could not check for updates",
  delete: "Could not delete the model",
};

/**
 * Stop, update and delete for installed models; one mutation per verb so each
 * button tracks its own state. A failure is reported as a toast, since the
 * row that started it may be gone (or scrolled away) by the time it fails —
 * unless the caller shows the error where the user is already looking
 * (`inlineErrors`, e.g. a confirm dialog that stays open on failure).
 */
export function useModelAction(verb: Verb, { inlineErrors = false }: { inlineErrors?: boolean } = {}) {
  const toasts = useToasts();
  return useMutation({
    mutationKey: modelMutationKey(verb),
    mutationFn: (modelId: string) => {
      const path = `/models/${encodeURIComponent(modelId)}`;
      return verb === "delete" ? api(path, { method: "DELETE" }) : api(`${path}/${verb}`, { method: "POST" });
    },
    onSuccess: refresh,
    onError: (error) => {
      if (!inlineErrors) toasts.notifyError(error, FAILURE[verb]);
    },
  });
}
