import { defineStore } from "pinia";
import { persistedRef } from "@/lib/persistedRef";

/** Generation defaults for the built-in chat, remembered across launches. */
export interface ChatPreferences {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

export const DEFAULT_CHAT_PREFERENCES: ChatPreferences = {
  systemPrompt: "",
  temperature: 0.7,
  maxTokens: 2048,
};

export const TEMPERATURE_RANGE = { min: 0, max: 2, step: 0.05 } as const;
export const MAX_TOKENS_RANGE = { min: 256, max: 32768, step: 256 } as const;

export const usePreferences = defineStore("preferences", () => {
  const systemPrompt = persistedRef("mlxstudio.preferences.systemPrompt", DEFAULT_CHAT_PREFERENCES.systemPrompt);
  const temperature = persistedRef("mlxstudio.preferences.temperature", DEFAULT_CHAT_PREFERENCES.temperature);
  const maxTokens = persistedRef("mlxstudio.preferences.maxTokens", DEFAULT_CHAT_PREFERENCES.maxTokens);

  function update(patch: Partial<ChatPreferences>): void {
    if (patch.systemPrompt !== undefined) systemPrompt.value = patch.systemPrompt;
    if (patch.temperature !== undefined) temperature.value = patch.temperature;
    if (patch.maxTokens !== undefined) maxTokens.value = patch.maxTokens;
  }

  function resetChat(): void {
    systemPrompt.value = DEFAULT_CHAT_PREFERENCES.systemPrompt;
    temperature.value = DEFAULT_CHAT_PREFERENCES.temperature;
    maxTokens.value = DEFAULT_CHAT_PREFERENCES.maxTokens;
  }

  return { systemPrompt, temperature, maxTokens, update, resetChat };
});
