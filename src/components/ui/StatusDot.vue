<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { Tone } from "./Badge.vue";

/**
 * A plain status light, for things that are not models (a model's state is
 * drawn by ModelCore). Filled when something is on, hollow when idle; only
 * the accent tone glows, because only "live" is lit.
 */
const props = defineProps<{ tone: Tone | "idle" }>();

const COLOR: Record<Tone | "idle", string> = {
  neutral: "bg-subtle",
  accent: "bg-accent shadow-[0_0_8px_rgb(var(--accent)/0.8)]",
  safe: "bg-safe",
  warn: "bg-warn",
  danger: "bg-danger",
  idle: "border border-subtle bg-transparent",
};
</script>

<template>
  <span aria-hidden="true" :class="cn('inline-block h-[7px] w-[7px] shrink-0 rounded-full', COLOR[props.tone])" />
</template>
