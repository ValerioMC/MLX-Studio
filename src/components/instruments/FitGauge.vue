<script setup lang="ts">
/**
 * FitGauge — will this model fit? The track is everything this Mac can give a
 * model; the bar is what this one needs; the bright notch is what is free
 * *right now*. So the three answers read as geometry, not just as a badge:
 *
 *   fits     the bar ends before the notch            (safe)
 *   tight    the bar crosses the notch but not the end (warn — macOS will
 *            reclaim cache to make room)
 *   too big  the bar runs off the end of the track     (danger)
 */
import { computed } from "vue";
import { bytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import Badge, { type Tone } from "@/components/ui/Badge.vue";
import type { Fit } from "@/types";

const props = defineProps<{ fit: Fit; needBytes: number | null | undefined; usableBytes: number; freeBytes: number }>();

const FIT: Record<Fit, { label: string; tone: Tone; bar: string; title: string }> = {
  fits: { label: "Fits", tone: "safe", bar: "bg-safe", title: "Fits in free memory right now" },
  tight: {
    label: "Tight",
    tone: "warn",
    bar: "bg-warn",
    title: "Needs more than is free now, but fits once macOS reclaims cached memory",
  },
  too_big: { label: "Too big", tone: "danger", bar: "bg-danger", title: "Larger than this Mac can give a model" },
  unknown: { label: "Unknown", tone: "neutral", bar: "bg-subtle", title: "Size could not be estimated from the name" },
};

const look = computed(() => FIT[props.fit]);
const need = computed(() => (props.needBytes && props.usableBytes ? Math.min(props.needBytes / props.usableBytes, 1) : 0));
const notch = computed(() => (props.usableBytes ? Math.min(props.freeBytes / props.usableBytes, 1) : 0));
</script>

<template>
  <div class="flex w-[10.5rem] flex-col gap-1.5" :title="look.title">
    <div class="flex items-center justify-between">
      <span class="tabular text-sm font-medium">{{ bytes(needBytes) }}</span>
      <Badge :tone="look.tone" dot>{{ look.label }}</Badge>
    </div>
    <div class="relative h-1.5 rounded-full bg-fg/[0.07] shadow-[inset_0_1px_1px_rgb(0_0_0/0.35)]" aria-hidden="true">
      <div
        :class="cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out', look.bar)"
        :style="{ width: `${Math.max(need * 100, 3)}%` }"
      />
      <span
        v-if="notch > 0"
        class="absolute -bottom-[3px] -top-[3px] w-[2px] -translate-x-1/2 rounded-full bg-fg shadow-[0_0_4px_rgb(var(--fg)/0.6)]"
        :style="{ left: `${notch * 100}%` }"
      />
    </div>
  </div>
</template>
