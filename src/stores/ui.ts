import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

interface UIState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export const useUI = create<UIState>((set) => ({
  theme: "system",
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));

// Initialize on load.
if (typeof window !== "undefined") {
  applyTheme("system");
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (useUI.getState().theme === "system") applyTheme("system");
    });
}
