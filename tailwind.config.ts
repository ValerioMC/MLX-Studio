import type { Config } from "tailwindcss";

// Every color is a CSS variable holding an "R G B" triple (see globals.css), so
// the theme switches without recompiling and alpha utilities (bg-accent/12)
// still work. "-soft" (a ~12% wash) and "-line" (a ~28% hairline) are *derived*
// from the base here, never picked by hand.
const channel = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
const derived = (name: string, alpha: number) => `rgb(var(--${name}) / ${alpha})`;

function semantic(name: string) {
  return {
    DEFAULT: channel(name),
    soft: derived(name, 0.12),
    line: derived(name, 0.28),
  };
}

export default {
  content: ["./index.html", "./src/**/*.{ts,vue}"],
  theme: {
    // Replaced, not extended: a component can only use the tokens below, so a
    // stray `rounded-md` or `shadow-lg` is a build-time no-op instead of a
    // quietly inconsistent value.
    borderRadius: {
      none: "0",
      // Controls: buttons, fields, rows, badges — anything you press or type in.
      control: "8px",
      // Cards: panels, dialogs, popovers — anything that holds controls.
      card: "14px",
      // Round things only: dots, switches, the composer's send button, capsules.
      full: "9999px",
    },
    boxShadow: {
      none: "none",
      lift: "var(--shadow-lift)",
      modal: "var(--shadow-modal)",
      glow: "var(--shadow-glow)",
    },
    zIndex: {
      // The entire stacking scale, four steps.
      sticky: "20",
      overlay: "30",
      modal: "40",
      toast: "50",
    },
    // On a 13px root. Headings pull in as they grow; small text never tracks
    // out — a weight or color step does the job capitals would.
    fontSize: {
      "2xs": ["10.5px", { lineHeight: "14px", letterSpacing: "0.01em" }],
      xs: ["11.5px", { lineHeight: "16px" }],
      sm: ["12.5px", { lineHeight: "18px" }],
      base: ["13px", { lineHeight: "20px" }],
      md: ["14px", { lineHeight: "22px", letterSpacing: "-0.003em" }],
      lg: ["16px", { lineHeight: "24px", letterSpacing: "-0.008em" }],
      xl: ["20px", { lineHeight: "26px", letterSpacing: "-0.014em" }],
      "2xl": ["26px", { lineHeight: "32px", letterSpacing: "-0.02em" }],
      "3xl": ["34px", { lineHeight: "38px", letterSpacing: "-0.026em" }],
      display: ["60px", { lineHeight: "1", letterSpacing: "-0.045em" }],
    },
    fontFamily: {
      // Bundled (no network, no flash). Geist and Geist Mono are drawn as a
      // pair, so a model id or a figure set in mono sits in a sentence without
      // looking pasted in from another font system.
      sans: ["Geist Variable", "-apple-system", "BlinkMacSystemFont", "system-ui", "sans-serif"],
      mono: ["Geist Mono Variable", "ui-monospace", "SF Mono", "Menlo", "monospace"],
    },
    extend: {
      colors: {
        canvas: channel("canvas"),
        surface: channel("surface"),
        raised: channel("raised"),
        hover: channel("hover"),
        line: { DEFAULT: channel("line"), strong: channel("line-strong") },
        fg: channel("fg"),
        muted: channel("muted"),
        subtle: channel("subtle"),
        accent: {
          ...semantic("accent"),
          strong: channel("accent-strong"),
          deep: channel("accent-deep"),
          ink: channel("accent-ink"),
          text: channel("accent-text"),
        },
        safe: semantic("safe"),
        warn: semantic("warn"),
        danger: { ...semantic("danger"), ink: channel("danger-ink") },
        seg: {
          0: channel("seg-0"),
          1: channel("seg-1"),
          2: channel("seg-2"),
          3: channel("seg-3"),
          system: channel("seg-system"),
        },
      },
      spacing: {
        // One row height for lists, nav and menus, so they read as one grid.
        row: "34px",
        // Control heights: md for forms and toolbars, sm inside dense rows.
        control: "32px",
        "control-sm": "26px",
        // Fixed panes. The remaining pane always takes the rest.
        rail: "224px",
        list: "252px",
        // The window's title-bar strip (traffic lights, drag region).
        titlebar: "44px",
      },
      maxWidth: {
        page: "68rem",
        prose: "46rem",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      opacity: {
        8: "0.08",
        12: "0.12",
        15: "0.15",
        35: "0.35",
        45: "0.45",
        65: "0.65",
      },
    },
  },
  plugins: [],
} satisfies Config;
