<script setup lang="ts">
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "accent" | "positive" | "caution" | "danger";

const props = withDefaults(defineProps<{ tone?: Tone }>(), { tone: "neutral" });

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-accent/12 text-accent",
  positive: "bg-positive/12 text-positive",
  caution: "bg-caution/14 text-caution",
  danger: "bg-destructive/12 text-destructive",
};
</script>

<template>
  <!-- A short fact about a model or job: size, quantization, capability. -->
  <span
    :class="
      cn(
        'inline-flex h-[1.35rem] items-center gap-1 whitespace-nowrap rounded-sm px-1.5 text-xs font-medium tabular [&_svg]:h-3 [&_svg]:w-3',
        TONES[props.tone],
      )
    "
  >
    <slot />
  </span>
</template>
