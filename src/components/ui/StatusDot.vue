<script setup lang="ts">
import { cn } from "@/lib/utils";
import type { Tone } from "./Tag.vue";

const props = defineProps<{ tone: Tone | "idle" }>();

const COLOR: Record<Tone | "idle", string> = {
  neutral: "bg-muted-foreground",
  accent: "bg-accent",
  positive: "bg-positive shadow-[0_0_0_3px_rgb(var(--positive)/0.18)]",
  caution: "bg-caution",
  danger: "bg-destructive",
  idle: "border border-muted-foreground/60 bg-transparent",
};
</script>

<template>
  <!-- A status light: filled when live, hollow when idle. -->
  <span aria-hidden="true" :class="cn('inline-block h-[7px] w-[7px] shrink-0 rounded-full', COLOR[props.tone])" />
</template>
