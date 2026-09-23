import { QueryClient, useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { Activity, Conversation, MemoryEstimate, Model } from "@/types";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2000, refetchOnWindowFocus: false } },
});

export const queryKeys = {
  models: ["models"] as const,
  conversations: ["conversations"] as const,
  activity: ["activity"] as const,
  settings: ["settings"] as const,
  estimate: (modelId: string, contextLength: number) => ["estimate", modelId, contextLength] as const,
};

/** Installed models. Polled so status changes made by API clients show up. */
export function useModels() {
  return useQuery({
    queryKey: queryKeys.models,
    queryFn: () => api<Model[]>("/models"),
    refetchInterval: 4000,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => api<{ items: Conversation[] }>("/conversations").then((r) => r.items),
  });
}

export function useActivity() {
  return useQuery({
    queryKey: queryKeys.activity,
    queryFn: () => api<{ items: Activity[] }>("/system/activity?limit=12").then((r) => r.items),
    refetchInterval: 5000,
  });
}

export interface AppSettings {
  hf_token_set: boolean;
  models_dir: string;
}

export function useAppSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => api<AppSettings>("/settings"),
  });
}

export function fetchEstimate(modelId: string, contextLength: number): Promise<MemoryEstimate> {
  return api<MemoryEstimate>(`/models/${encodeURIComponent(modelId)}/estimate?context_length=${contextLength}`);
}
