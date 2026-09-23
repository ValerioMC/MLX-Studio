<script setup lang="ts">
/**
 * A live trace: the last minute of a 0–100 reading, drawn like an oscilloscope
 * line with a soft fill beneath and a bright dot at "now". It scrolls because
 * the data does, never on its own.
 *
 * `fluid` stretches it to fill its box (a band along the bottom of a tile):
 * the line keeps its stroke width while the drawing scales, and the "now"
 * dot is dropped because a stretched circle would read as a smear.
 */
import { computed, useId } from "vue";

const props = withDefaults(
  defineProps<{ values: readonly number[]; width?: number; height?: number; capacity?: number; fluid?: boolean }>(),
  { width: 120, height: 32, capacity: 60, fluid: false },
);

const gradientId = `spark-${useId()}`;

const points = computed(() => {
  const step = props.width / Math.max(props.capacity - 1, 1);
  const offset = props.capacity - props.values.length;
  return props.values.map((v, i) => ({
    x: (offset + i) * step,
    y: props.height - 2 - (Math.min(Math.max(v, 0), 100) / 100) * (props.height - 4),
  }));
});
const line = computed(() => points.value.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(""));
const area = computed(() => {
  const first = points.value[0];
  const last = points.value[points.value.length - 1];
  return first && last ? `${line.value}L${last.x},${props.height}L${first.x},${props.height}Z` : "";
});
const head = computed(() => points.value[points.value.length - 1]);
</script>

<template>
  <svg
    :width="fluid ? '100%' : width"
    :height="fluid ? '100%' : height"
    :viewBox="`0 0 ${width} ${height}`"
    :preserveAspectRatio="fluid ? 'none' : undefined"
    fill="none"
    aria-hidden="true"
    class="overflow-visible"
  >
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgb(var(--accent))" stop-opacity="0.28" />
        <stop offset="100%" stop-color="rgb(var(--accent))" stop-opacity="0" />
      </linearGradient>
    </defs>
    <line v-if="!fluid" x1="0" :y1="height - 0.5" :x2="width" :y2="height - 0.5" stroke="rgb(var(--line))" />
    <path v-if="area" :d="area" :fill="`url(#${gradientId})`" />
    <path
      v-if="line"
      :d="line"
      stroke="rgb(var(--accent))"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
    <circle v-if="head && !fluid" :cx="head.x" :cy="head.y" r="2.5" fill="rgb(var(--accent))" class="drop-shadow-[0_0_4px_rgb(var(--accent))]" />
  </svg>
</template>
