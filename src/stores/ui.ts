import { defineStore } from "pinia";
import { watch } from "vue";
import { persistedRef } from "@/lib/persistedRef";

export type Theme = "light" | "dark" | "system";

const darkQuery = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

/** :root is dark by default (see globals.css); ".light" opts a resolved-light theme out. */
function applyTheme(theme: Theme): void {
  const dark = theme === "dark" || (theme === "system" && (darkQuery?.matches ?? true));
  document.documentElement.classList.toggle("light", !dark);
}

export const useUI = defineStore("ui", () => {
  const theme = persistedRef<Theme>("mlxstudio.ui.theme", "system");

  function setTheme(next: Theme): void {
    theme.value = next;
  }

  // Paint the stored theme before first render, and follow the OS while on "system".
  watch(theme, applyTheme, { immediate: true });
  darkQuery?.addEventListener("change", () => {
    if (theme.value === "system") applyTheme("system");
  });

  return { theme, setTheme };
});
