<script setup lang="ts">
import { cn } from "@/lib/utils";
import Spinner from "./Spinner.vue";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-quiet";
type Size = "sm" | "md" | "icon" | "icon-sm";

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    /** Swaps the leading icon for a spinner, blocks clicks, keeps the size. */
    loading?: boolean;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
  }>(),
  { variant: "primary", size: "md", loading: false, disabled: false, type: "button" },
);

// Physical, not flat: every variant presses 1px down, and the filled ones
// carry a lit top edge (inset highlight) so they read as keys, not stickers.
const BASE =
  "no-drag group/button relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control font-medium transition-[background-color,color,box-shadow,transform,opacity] duration-150 ease-out active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:shrink-0";

// `primary` is the signal color: one per view, the thing you came to do.
// `danger-quiet` is for a destructive action repeated down a list — ghost at
// rest, red only on hover — so a column of rows isn't a column of alarms. The
// confirm dialog is the real guard; the button only has to not scream.
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_1px_2px_rgb(0_0_0/0.35),0_0_0_1px_rgb(var(--accent-deep)/0.6)] hover:bg-accent-strong hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_0_0_1px_rgb(var(--accent-deep)/0.6),0_0_20px_-4px_rgb(var(--accent)/0.55)]",
  secondary:
    "bg-raised text-fg shadow-lift ring-1 ring-inset ring-line hover:bg-hover hover:ring-line-strong",
  ghost: "text-muted hover:bg-fg/[0.06] hover:text-fg",
  danger:
    "bg-danger text-danger-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_1px_2px_rgb(0_0_0/0.35)] hover:brightness-110",
  "danger-quiet": "text-muted hover:bg-danger-soft hover:text-danger",
};

const SIZES: Record<Size, string> = {
  sm: "h-control-sm gap-1.5 px-2.5 text-sm",
  md: "h-control gap-2 px-3.5 text-base",
  icon: "h-control w-control",
  "icon-sm": "h-control-sm w-control-sm",
};
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="cn(BASE, VARIANTS[props.variant], SIZES[props.size])"
  >
    <Spinner v-if="loading" />
    <slot />
  </button>
</template>
