<script setup lang="ts">
/**
 * MemoryDial — the Mac's unified memory as one instrument, the centerpiece of
 * Overview. It answers the question this app exists to answer — "what can I
 * still load?" — at a glance from across the desk.
 *
 * Anatomy, outside in:
 *   bezel     One tick per cell of memory (usually a GB), dim; a tick under a
 *             loaded model takes that model's color. Every fourth is longer, so
 *             a size can be *counted*, not just estimated.
 *   ring      A 270° sweep, clockwise from the lower left. Each loaded model is
 *             an arc in its own tone (the same tone as its core everywhere
 *             else); macOS and other apps are a dim arc; the safety reserve is
 *             hatched; free memory is the empty track that is left.
 *   needle    A bright notch where spoken-for memory ends and free begins —
 *             the one line on the dial that says "you are here".
 *   center    The headline figure: GB free for models. Hovering an arc (or its
 *             legend row — `hovered` is shared with the legend) swaps it for
 *             that segment's name and size.
 *
 * Motion: arcs and the needle glide to new values (≈0.7s, ease-out) as the
 * 1 Hz stats arrive, and sweep in from zero the first time the dial is shown.
 * While a model is generating (`busyKey`), a short light travels along its
 * arc — and only then: a dial with nothing happening is perfectly still.
 */
import { computed, onMounted, ref } from "vue";
import { memoryCells, type MemoryLedger, type MemorySegment } from "@/lib/memory";
import { bytes, gigabytes } from "@/lib/format";

const props = withDefaults(
  defineProps<{
    ledger: MemoryLedger;
    hovered?: string | null;
    /** Segment key of the model currently generating, if any. */
    busyKey?: string | null;
    size?: number;
  }>(),
  { hovered: null, busyKey: null, size: 280 },
);
const emit = defineEmits<{ "update:hovered": [key: string | null] }>();

const SWEEP = 270;
const START = 135; // degrees clockwise from 3 o'clock: the lower-left end of the sweep
const GAP = 1.4; // degrees left empty between neighbouring arcs
const R = 82;
const STROKE = 13;
const CENTER = 100;
const MAX_TICKS = 64;

// First paint draws every arc at zero, then lets them grow into place.
const ready = ref(false);
onMounted(() => requestAnimationFrame(() => (ready.value = true)));

interface Arc {
  segment: MemorySegment;
  start: number;
  length: number;
}

const arcs = computed<Arc[]>(() => {
  const total = props.ledger.totalBytes || 1;
  let cursor = 0;
  return props.ledger.segments.map((segment) => {
    const span = (segment.bytes / total) * SWEEP;
    const arc = { segment, start: cursor + GAP / 2, length: Math.max(span - GAP, 0.01) };
    cursor += span;
    return arc;
  });
});
const drawn = computed(() => arcs.value.filter((a) => a.segment.kind !== "free"));

/** Where spoken-for memory ends: the needle's angle along the sweep. */
const usedAngle = computed(() => {
  const free = props.ledger.segments.find((s) => s.kind === "free")?.bytes ?? 0;
  return ((props.ledger.totalBytes - free) / (props.ledger.totalBytes || 1)) * SWEEP;
});

const ticks = computed(() => {
  const { cells } = memoryCells(props.ledger, MAX_TICKS);
  const real = cells.filter((c) => c.kind !== "overflow");
  return real.map((cell, i) => ({
    angle: START + ((i + 0.5) / real.length) * SWEEP,
    major: i % 4 === 0,
    tone: cell.kind === "model" ? cell.tone : undefined,
  }));
});

function strokeFor(segment: MemorySegment): string {
  if (segment.kind === "model" || segment.kind === "pending") return `rgb(var(--seg-${(segment.tone ?? 0) % 4}))`;
  if (segment.kind === "reserve") return "url(#dial-hatch)";
  return "rgb(var(--seg-system))";
}

function dash(arc: Arc): { strokeDasharray: string; strokeDashoffset: number } {
  const length = ready.value ? arc.length : 0;
  return { strokeDasharray: `${length} ${360 - length}`, strokeDashoffset: -(ready.value ? arc.start : 0) };
}

const focus = computed(() => props.ledger.segments.find((s) => s.key === props.hovered) ?? null);
const busyArc = computed(() => arcs.value.find((a) => a.segment.key === props.busyKey) ?? null);

function point(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}
</script>

<template>
  <div class="relative shrink-0" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      :aria-label="ledger.segments.map((s) => `${s.label} ${bytes(s.bytes)}`).join(', ')"
      class="overflow-visible"
    >
      <defs>
        <pattern id="dial-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="3" height="3" fill="rgb(var(--seg-reserve) / 0.18)" />
          <line x1="0" y1="0" x2="0" y2="3" stroke="rgb(var(--seg-reserve) / 0.8)" stroke-width="1.2" />
        </pattern>
        <radialGradient id="dial-glass" cx="50%" cy="38%" r="60%">
          <stop offset="0%" stop-color="rgb(var(--fg))" stop-opacity="0.06" />
          <stop offset="100%" stop-color="rgb(var(--fg))" stop-opacity="0" />
        </radialGradient>
        <filter id="dial-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <!-- Glass face and an engraved inner ring: depth, so the dial is an
           object and not a chart. -->
      <circle :cx="CENTER" :cy="CENTER" r="70" fill="url(#dial-glass)" />
      <circle :cx="CENTER" :cy="CENTER" r="70" stroke="rgb(var(--fg) / 0.06)" />
      <circle :cx="CENTER" :cy="CENTER" r="66.5" stroke="rgb(0 0 0 / 0.25)" />

      <!-- Bezel ticks. -->
      <g>
        <line
          v-for="(t, i) in ticks"
          :key="i"
          :x1="point(t.angle, t.major ? 93 : 94.5).x"
          :y1="point(t.angle, t.major ? 93 : 94.5).y"
          :x2="point(t.angle, 98).x"
          :y2="point(t.angle, 98).y"
          :stroke="t.tone !== undefined ? `rgb(var(--seg-${t.tone % 4}))` : 'rgb(var(--subtle))'"
          :stroke-opacity="t.tone !== undefined ? 0.85 : t.major ? 0.55 : 0.28"
          stroke-width="1.1"
          stroke-linecap="round"
          class="transition-[stroke] duration-500"
        />
      </g>

      <!-- Track: the whole 270°, recessed. -->
      <circle
        :cx="CENTER"
        :cy="CENTER"
        :r="R"
        pathLength="360"
        :stroke-width="STROKE"
        stroke="rgb(var(--canvas) / 0.8)"
        :stroke-dasharray="`${SWEEP} ${360 - SWEEP}`"
        :transform="`rotate(${START} ${CENTER} ${CENTER})`"
        stroke-linecap="round"
      />
      <circle
        :cx="CENTER"
        :cy="CENTER"
        :r="R"
        pathLength="360"
        :stroke-width="STROKE"
        stroke="rgb(var(--fg) / 0.045)"
        :stroke-dasharray="`${SWEEP} ${360 - SWEEP}`"
        :transform="`rotate(${START} ${CENTER} ${CENTER})`"
        stroke-linecap="round"
      />

      <!-- Glow under lit (model) arcs. -->
      <g filter="url(#dial-glow)" opacity="0.55">
        <circle
          v-for="arc in drawn.filter((a) => a.segment.kind === 'model')"
          :key="`glow-${arc.segment.key}`"
          :cx="CENTER"
          :cy="CENTER"
          :r="R"
          pathLength="360"
          :stroke-width="STROKE - 4"
          :stroke="strokeFor(arc.segment)"
          :style="dash(arc)"
          :transform="`rotate(${START} ${CENTER} ${CENTER})`"
          class="dial-arc"
        />
      </g>

      <!-- The arcs. -->
      <circle
        v-for="arc in drawn"
        :key="arc.segment.key"
        :cx="CENTER"
        :cy="CENTER"
        :r="R"
        pathLength="360"
        :stroke-width="STROKE"
        :stroke="strokeFor(arc.segment)"
        :stroke-opacity="arc.segment.kind === 'system' ? 0.7 : 1"
        :style="dash(arc)"
        :transform="`rotate(${START} ${CENTER} ${CENTER})`"
        :class="['dial-arc cursor-default', hovered && hovered !== arc.segment.key && 'dimmed']"
        @mouseenter="emit('update:hovered', arc.segment.key)"
        @mouseleave="emit('update:hovered', null)"
      />
      <!-- A top-lit bevel over every arc, so the ring reads as one machined part. -->
      <circle
        v-for="arc in drawn"
        :key="`bevel-${arc.segment.key}`"
        :cx="CENTER"
        :cy="CENTER"
        :r="R + STROKE / 2 - 1.5"
        pathLength="360"
        stroke-width="1.5"
        stroke="white"
        stroke-opacity="0.22"
        :style="dash(arc)"
        :transform="`rotate(${START} ${CENTER} ${CENTER})`"
        class="dial-arc pointer-events-none"
      />

      <!-- Generating: a short light travelling along that model's arc. -->
      <circle
        v-if="busyArc && ready"
        :cx="CENTER"
        :cy="CENTER"
        :r="R"
        pathLength="360"
        :stroke-width="STROKE - 5"
        stroke="white"
        stroke-opacity="0.75"
        stroke-linecap="round"
        :transform="`rotate(${START} ${CENTER} ${CENTER})`"
        class="traveller pointer-events-none"
        :style="{
          '--from': `${-busyArc.start}`,
          '--to': `${-(busyArc.start + Math.max(busyArc.length - 6, 0))}`,
        }"
      />

      <!-- The needle: where free memory begins. -->
      <g
        class="needle"
        :style="{ transform: `rotate(${START + (ready ? usedAngle : 0)}deg)`, transformOrigin: `${CENTER}px ${CENTER}px` }"
      >
        <line :x1="CENTER + R - 11" :y1="CENTER" :x2="CENTER + R + 11" :y2="CENTER" stroke="rgb(var(--fg))" stroke-width="2" stroke-linecap="round" />
        <circle :cx="CENTER + R + 11" :cy="CENTER" r="2" fill="rgb(var(--fg))" />
      </g>
    </svg>

    <!-- Center readout. -->
    <div class="pointer-events-none absolute inset-0 grid place-items-center">
      <Transition name="crossfade" mode="out-in">
        <div v-if="focus" :key="focus.key" class="flex max-w-[60%] flex-col items-center text-center">
          <span class="line-clamp-2 text-sm font-medium text-muted">{{ focus.label }}</span>
          <span class="tabular pt-0.5 text-3xl font-semibold">{{ bytes(focus.bytes) }}</span>
          <span class="tabular text-xs text-subtle">
            {{ Math.round((focus.bytes / (ledger.totalBytes || 1)) * 100) }}% of memory
          </span>
        </div>
        <div v-else key="free" class="flex flex-col items-center">
          <span class="tabular font-semibold leading-none tracking-[-0.05em]" :style="{ fontSize: `${size * 0.22}px` }">
            {{ gigabytes(ledger.freeForModelsBytes) }}
          </span>
          <span class="pt-1.5 text-sm font-medium text-muted">GB free for models</span>
        </div>
      </Transition>
    </div>
    <!-- Scale label in the dial's open bottom. -->
    <p class="tabular absolute inset-x-0 bottom-[6%] text-center text-xs text-subtle">
      of {{ gigabytes(ledger.totalBytes) }} GB
    </p>
  </div>
</template>

<style scoped>
.dial-arc {
  transition:
    stroke-dasharray 700ms var(--ease-out),
    stroke-dashoffset 700ms var(--ease-out),
    opacity 200ms ease;
}
.dimmed {
  opacity: 0.35;
}
.needle {
  transition: transform 700ms var(--ease-out);
  filter: drop-shadow(0 0 3px rgb(var(--fg) / 0.6));
}
.traveller {
  stroke-dasharray: 6 354;
  animation: travel 1.6s var(--ease-out) infinite;
}
@keyframes travel {
  from {
    stroke-dashoffset: var(--from);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  to {
    stroke-dashoffset: var(--to);
    opacity: 0;
  }
}
</style>
