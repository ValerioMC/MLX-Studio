import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { queryClient, queryKeys } from "@/lib/api/queries";

type Verb = "stop" | "update" | "delete";

function refresh(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.models });
  void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
}

/** Stop, update and delete for installed models; one mutation per verb so each button tracks its own state. */
export function useModelAction(verb: Verb) {
  return useMutation({
    mutationFn: (modelId: string) => {
      const path = `/models/${encodeURIComponent(modelId)}`;
      return verb === "delete" ? api(path, { method: "DELETE" }) : api(`${path}/${verb}`, { method: "POST" });
    },
    onSuccess: refresh,
  });
}
