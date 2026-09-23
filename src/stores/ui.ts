import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface UIState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const darkQuery = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

function applyTheme(theme: Theme): void {
  const dark = theme === "dark" || (theme === "system" && (darkQuery?.matches ?? false));
  document.documentElement.classList.toggle("dark", dark);
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: "mlxstudio.ui",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => applyTheme(state?.theme ?? "system"),
    },
  ),
);

// Paint the stored theme before first render, and follow the OS while on "system".
if (typeof window !== "undefined") {
  applyTheme(useUI.getState().theme);
  darkQuery?.addEventListener("change", () => {
    if (useUI.getState().theme === "system") applyTheme("system");
  });
}
