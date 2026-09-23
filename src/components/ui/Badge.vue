<script setup lang="ts">
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "accent" | "safe" | "warn" | "danger";

/**
 * A short fact: a size, a quantization, a capability, a fit. Every tone is the
 * same triple — soft wash, full-strength text, hairline ring in the same hue —
 * so a badge's color is only ever its meaning. `mono` is for codes and counts.
 */
const props = withDefaults(defineProps<{ tone?: Tone; dot?: boolean; mono?: boolean }>(), {
  tone: "neutral",
  dot: false,
  mono: false,
});

const TONES: Record<Tone, string> = {
  neutral: "bg-fg/[0.05] text-muted ring-line-strong/70",
  accent: "bg-accent-soft text-accent-text ring-accent-line",
  safe: "bg-safe-soft text-safe ring-safe-line",
  warn: "bg-warn-soft text-warn ring-warn-line",
  danger: "bg-danger-soft text-danger ring-danger-line",
};
const DOTS: Record<Tone, string> = {
  neutral: "bg-subtle",
  accent: "bg-accent shadow-[0_0_6px_rgb(var(--accent)/0.8)]",
  safe: "bg-safe",
  warn: "bg-warn",
  danger: "bg-danger",
};
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-control px-1.5 text-xs font-medium ring-1 ring-inset [&_svg]:h-3 [&_svg]:w-3',
        TONES[props.tone],
        mono && 'tabular font-mono text-2xs',
      )
    "
  >
    <span v-if="dot" aria-hidden="true" :class="cn('h-1.5 w-1.5 rounded-full', DOTS[props.tone])" />
    <slot />
  </span>
</template>
