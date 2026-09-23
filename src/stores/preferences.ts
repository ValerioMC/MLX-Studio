import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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

interface PreferencesState extends ChatPreferences {
  update: (patch: Partial<ChatPreferences>) => void;
  resetChat: () => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_CHAT_PREFERENCES,
      update: (patch) => set(patch),
      resetChat: () => set(DEFAULT_CHAT_PREFERENCES),
    }),
    {
      name: "mlxstudio.preferences",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
