import type { Config } from "tailwindcss";

// Colors are driven by CSS variables (see src/styles/globals.css), each an
// "R G B" triple, so light/dark changes happen without recompiling Tailwind
// and Tailwind's alpha utilities (bg-accent/12, ...) still work.
const channel = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  // Theming runs entirely on CSS custom properties (see globals.css): dark is
  // the default value, a ".light" class on <html> overrides it. No Tailwind
  // "dark:" variant is used anywhere, so darkMode is left at its default.
  content: ["./index.html", "./src/**/*.{ts,vue}"],
  theme: {
    // A native-feeling scale on a 13px root (Apple's own control text size),
    // with roomier line-height than a dense dev tool: this app has few
    // elements on screen at once, so it can afford to breathe.
    fontSize: {
      "2xs": ["0.8125rem", { lineHeight: "1.15rem" }], // 10.5px
      xs: ["0.875rem", { lineHeight: "1.25rem" }], // 11.4px
      sm: ["0.9615rem", { lineHeight: "1.4rem" }], // 12.5px
      base: ["1rem", { lineHeight: "1.5rem" }], // 13px
      md: ["1.077rem", { lineHeight: "1.6rem" }], // 14px
      lg: ["1.23rem", { lineHeight: "1.7rem" }], // 16px
      xl: ["1.54rem", { lineHeight: "1.95rem" }], // 20px
      "2xl": ["2.15rem", { lineHeight: "2.45rem" }], // 28px
      "3xl": ["3.7rem", { lineHeight: "1" }], // 48px
    },
    extend: {
      opacity: {
        8: "0.08",
        10: "0.1",
        12: "0.12",
        14: "0.14",
        18: "0.18",
        28: "0.28",
        45: "0.45",
      },
      spacing: {
        row: "2.5rem", // 40px: the one row height shared by lists, controls and the sidebar
      },
      zIndex: {
        sticky: "20",
        overlay: "30",
        modal: "40",
        toast: "50",
      },
      colors: {
        border: channel("border"),
        input: channel("input"),
        ring: channel("ring"),
        background: channel("background"),
        foreground: channel("foreground"),
        muted: {
          DEFAULT: channel("muted"),
          foreground: channel("muted-foreground"),
        },
        subtle: channel("subtle"),
        card: {
          DEFAULT: channel("card"),
          foreground: channel("card-foreground"),
        },
        accent: {
          DEFAULT: channel("accent"),
          foreground: channel("accent-foreground"),
          strong: channel("accent-strong"),
        },
        positive: channel("positive"),
        caution: channel("caution"),
        destructive: {
          DEFAULT: channel("destructive"),
          foreground: channel("destructive-foreground"),
        },
        sidebar: channel("sidebar"),
        seg: {
          0: channel("seg-0"),
          1: channel("seg-1"),
          2: channel("seg-2"),
          3: channel("seg-3"),
          system: channel("seg-system"),
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)", // 16px — the composer, the biggest panels
        lg: "var(--radius)", // 12px — cards, dialogs, popovers
        md: "calc(var(--radius) - 4px)", // 8px — controls: buttons, inputs, rows
        sm: "calc(var(--radius) - 6px)", // 6px — tags, small chips
      },
      fontFamily: {
        // No bundled typeface: this is a Mac-only app, so the system stack
        // resolves to real San Francisco, matches the user's own text-size
        // accessibility setting, and costs nothing to load.
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      keyframes: {
        // A dialog opening: backdrop fades, panel rises and scales in.
        "dialog-in": {
          from: { opacity: "0", transform: "translateY(6px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        // An anchored popover: smaller rise, no backdrop.
        "popover-in": {
          from: { opacity: "0", transform: "translateY(4px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "scrim-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        caret: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
      },
      animation: {
        "dialog-in": "dialog-in 160ms cubic-bezier(0.16, 1, 0.3, 1)",
        "popover-in": "popover-in 140ms cubic-bezier(0.16, 1, 0.3, 1)",
        "scrim-in": "scrim-in 160ms ease-out",
        caret: "caret 1s steps(1) infinite",
        pulse: "pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
