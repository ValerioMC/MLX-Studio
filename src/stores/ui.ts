import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { persistedRef } from "@/lib/persistedRef";
import type { Model } from "@/types";

export type Theme = "light" | "dark" | "system";

/** What happens once a model started from the shared Start dialog is loaded. */
export type AfterStart = "open-chat" | "stay";

export interface StartRequest {
  model: Model;
  after: AfterStart;
}

const darkQuery = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

/** :root is dark by default (see globals.css); ".light" opts a resolved-light theme out. */
function applyTheme(theme: Theme): void {
  const dark = theme === "dark" || (theme === "system" && (darkQuery?.matches ?? true));
  document.documentElement.classList.toggle("light", !dark);
}

export const useUI = defineStore("ui", () => {
  const theme = persistedRef<Theme>("mlxstudio.ui.theme", "system");
  /** The ⌘K command palette. */
  const paletteOpen = ref(false);
  /**
   * The one Start dialog, owned by the shell: any page, the palette or the
   * tray asks for it here, so starting a model looks and behaves the same
   * from everywhere.
   */
  const startRequest = ref<StartRequest | null>(null);

  function setTheme(next: Theme): void {
    theme.value = next;
  }

  function requestStart(model: Model, after: AfterStart = "stay"): void {
    startRequest.value = { model, after };
  }

  // Paint the stored theme before first render, and follow the OS while on "system".
  watch(theme, applyTheme, { immediate: true });
  darkQuery?.addEventListener("change", () => {
    if (theme.value === "system") applyTheme("system");
  });

  return { theme, setTheme, paletteOpen, startRequest, requestStart };
});
