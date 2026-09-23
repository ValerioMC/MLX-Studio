<script setup lang="ts">
/**
 * ProgressRing — a download's state, drawn on the same bezel-and-core geometry
 * as ModelCore so a download visibly *becomes* a model: the ring fills as the
 * bytes arrive, and when it completes the core fills and a check is drawn.
 *
 *   queued       Track only, with a slow dashed rotation of the track itself:
 *                waiting its turn.
 *   downloading  The arc fills clockwise to the percentage, lit in the signal
 *                color with a soft glow; the percentage sits in the core.
 *   paused       The arc holds where it stopped, dimmed; two bars in the core.
 *   failed       The arc holds and turns danger; a bang in the core.
 *   completed    Ring closes in the safe color with a check. The check *draws
 *                itself* only when the download finishes while you watch —
 *                a list of finished downloads opened later just shows it.
 */
import { computed, ref, watch } from "vue";
import type { DownloadStatus } from "@/types";

const props = withDefaults(defineProps<{ status: DownloadStatus; percent: number; size?: number }>(), { size: 36 });

const justCompleted = ref(false);
watch(
  () => props.status,
  (next, previous) => {
    justCompleted.value = next === "completed" && previous !== "completed";
  },
);

const length = computed(() => (props.status === "completed" ? 100 : Math.max(Math.min(props.percent, 100), 1.5)));
</script>

<template>
  <span
    role="img"
    :aria-label="`${status}, ${Math.round(percent)}%`"
    :class="['ring-root relative inline-grid shrink-0 place-items-center', `is-${status}`]"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg :width="size" :height="size" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <circle cx="18" cy="18" r="15" class="track" />
      <circle
        cx="18"
        cy="18"
        r="15"
        pathLength="100"
        class="arc"
        transform="rotate(-90 18 18)"
        :style="{ strokeDasharray: `${length} ${100 - length}` }"
      />
      <!-- core glyphs -->
      <g v-if="status === 'paused'" class="glyph">
        <rect x="14" y="13" width="2.6" height="10" rx="1" />
        <rect x="19.4" y="13" width="2.6" height="10" rx="1" />
      </g>
      <g v-else-if="status === 'failed'" class="glyph">
        <rect x="16.8" y="11.5" width="2.4" height="8.5" rx="1.2" />
        <circle cx="18" cy="23.5" r="1.4" />
      </g>
      <template v-else-if="status === 'completed'">
        <circle cx="18" cy="18" r="10" class="done-disc" />
        <path d="M13.5 18.3l3 3 6-6.2" pathLength="1" :class="['check', justCompleted && 'drawing']" />
      </template>
      <text v-else x="18" y="18" text-anchor="middle" dominant-baseline="central" class="pct">
        {{ Math.round(percent) }}
      </text>
    </svg>
  </span>
</template>

<style scoped>
.track {
  stroke: rgb(var(--fg) / 0.08);
  stroke-width: 3;
}
.arc {
  stroke: rgb(var(--accent));
  stroke-width: 3;
  stroke-linecap: round;
  transition:
    stroke-dasharray 600ms var(--ease-out),
    stroke 300ms ease;
}
.is-downloading .arc {
  filter: drop-shadow(0 0 3px rgb(var(--accent) / 0.7));
}
.is-queued .track {
  stroke-dasharray: 2 3;
  transform-origin: 18px 18px;
  animation: spin 6s linear infinite;
}
.is-queued .arc {
  opacity: 0;
}
.is-paused .arc {
  stroke: rgb(var(--muted));
}
.is-failed .arc {
  stroke: rgb(var(--danger));
}
.is-completed .arc {
  stroke: rgb(var(--safe));
}
.glyph {
  fill: rgb(var(--muted));
}
.is-failed .glyph {
  fill: rgb(var(--danger));
}
.pct {
  fill: rgb(var(--fg));
  font-size: 9.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.done-disc {
  fill: rgb(var(--safe) / 0.14);
}
.check {
  stroke: rgb(var(--safe));
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.check.drawing {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 420ms 120ms var(--ease-out) forwards;
}
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
