import type { Config } from "tailwindcss";

// Colors are driven by CSS variables (see src/styles/globals.css) so light/dark
// changes happen without recompiling Tailwind.
const channel = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    // A desktop scale on a 13px root: dense like a native Mac app.
    fontSize: {
      "2xs": ["0.8125rem", { lineHeight: "1.1rem" }], // 10.5px
      xs: ["0.875rem", { lineHeight: "1.2rem" }], // 11.4px
      sm: ["0.9615rem", { lineHeight: "1.35rem" }], // 12.5px
      base: ["1rem", { lineHeight: "1.45rem" }], // 13px
      md: ["1.077rem", { lineHeight: "1.55rem" }], // 14px
      lg: ["1.23rem", { lineHeight: "1.65rem" }], // 16px
      xl: ["1.54rem", { lineHeight: "1.9rem" }], // 20px
      "2xl": ["2.15rem", { lineHeight: "2.4rem" }], // 28px
      "3xl": ["3.7rem", { lineHeight: "1" }], // 48px
    },
    extend: {
      opacity: {
        8: "0.08",
        12: "0.12",
        14: "0.14",
        18: "0.18",
        28: "0.28",
        45: "0.45",
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
        card: {
          DEFAULT: channel("card"),
          foreground: channel("card-foreground"),
        },
        accent: {
          DEFAULT: channel("accent"),
          foreground: channel("accent-foreground"),
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
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
      },
      fontFamily: {
        sans: ["Instrument Sans Variable", "-apple-system", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono Variable", "SF Mono", "ui-monospace", "Menlo", "monospace"],
      },
      keyframes: {
        "dialog-in": {
          from: { opacity: "0", transform: "translateY(6px) scale(0.985)" },
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
        "dialog-in": "dialog-in 160ms cubic-bezier(0.2, 0.9, 0.3, 1)",
        "scrim-in": "scrim-in 160ms ease-out",
        caret: "caret 1s steps(1) infinite",
        pulse: "pulse 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
