<script setup lang="ts">
import { cn } from "@/lib/utils";

// Rows match the real content's height (var(--spacing-row) equivalent, h-row)
// so nothing reflows when data arrives; a moving gradient sweep reads as
// "loading" without demanding attention.
withDefaults(defineProps<{ variant?: "row" | "text" | "block" }>(), { variant: "text" });
</script>

<template>
  <span
    role="status"
    aria-live="polite"
    aria-busy="true"
    :class="
      cn(
        'block animate-pulse rounded-md bg-muted',
        variant === 'row' && 'h-row w-full',
        variant === 'text' && 'h-3 w-full',
        variant === 'block' && 'h-24 w-full',
      )
    "
  >
    <span class="sr-only">Loading</span>
  </span>
</template>
