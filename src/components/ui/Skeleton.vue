<script setup lang="ts">
import { cn } from "@/lib/utils";

/**
 * Stand-in for content that is on its way. Each variant has the *shape* of
 * the real thing — `row` is exactly the shared row height, `card` a panel —
 * so nothing reflows when data lands. A band of light sweeps across rather
 * than the whole block blinking, which reads as "arriving", not "broken".
 */
withDefaults(defineProps<{ variant?: "text" | "row" | "card" | "block" }>(), { variant: "text" });
</script>

<template>
  <span
    role="status"
    aria-live="polite"
    aria-busy="true"
    :class="
      cn(
        'block bg-[length:200%_100%] [animation:sweep_1.6s_linear_infinite]',
        'bg-[linear-gradient(90deg,rgb(var(--fg)/0.04)_0%,rgb(var(--fg)/0.04)_40%,rgb(var(--fg)/0.09)_50%,rgb(var(--fg)/0.04)_60%,rgb(var(--fg)/0.04)_100%)]',
        variant === 'text' && 'h-3 w-full rounded-full',
        variant === 'row' && 'h-row w-full rounded-control',
        variant === 'card' && 'h-28 w-full rounded-card',
        variant === 'block' && 'h-20 w-full rounded-control',
      )
    "
  >
    <span class="sr-only">Loading</span>
  </span>
</template>
