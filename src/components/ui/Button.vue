<script setup lang="ts">
import { Loader2 } from "lucide-vue-next";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-quiet";
type Size = "sm" | "md" | "icon" | "icon-sm";

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    /** Shows a spinner in place of the icon and blocks clicks. */
    loading?: boolean;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
  }>(),
  { variant: "primary", size: "md", loading: false, disabled: false, type: "button" },
);

const BASE =
  "no-drag inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-100 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0";

// `danger-quiet` matters for a destructive action repeated down a list: ghost
// at rest, red only on hover, so a column of rows isn't a column of alarms —
// the confirm dialog is the actual guard, the button just needs to not scream.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-strong",
  secondary: "bg-card text-foreground shadow-float hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-destructive text-destructive-foreground hover:brightness-110",
  "danger-quiet": "text-muted-foreground hover:bg-destructive/12 hover:text-destructive",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 gap-1.5 px-2.5 text-sm",
  md: "h-8 gap-2 px-3 text-sm",
  icon: "h-8 w-8",
  "icon-sm": "h-6 w-6",
};
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    :class="cn(BASE, VARIANTS[props.variant], SIZES[props.size])"
  >
    <Loader2 v-if="loading" class="animate-spin" aria-hidden="true" />
    <slot />
  </button>
</template>
