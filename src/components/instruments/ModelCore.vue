<script setup lang="ts">
/**
 * ModelCore — the one drawing that means "a model", in every state it can be in.
 *
 * It is a single object, not six icons: a bezel ring around a core, like a
 * reactor seen from above. What changes between states is only how lit the
 * ring is, how full the core is, and whether anything moves — so after a day
 * with the app you read "the ring is closed and the core is lit" as *loaded*
 * without thinking about it.
 *
 * State machine (what each state looks like, and why):
 *
 *   idle        A hairline ring and a pilot-light speck in the middle. Installed,
 *               costs nothing, ready. Nothing moves: a model at rest has no pulse.
 *   loading     The ring dims to a track and a comet runs around it, lighting
 *               the bezel's ticks as it passes; the core swells slowly. Weights
 *               are streaming into memory — the only state that orbits steadily.
 *   running     The ring closes in the model's own color (its memory-ledger tone,
 *               so the sidebar core and its slice of the dial match) and the core
 *               is a lit disc. Still: loaded is a *steady* state, so it is drawn
 *               steady. Motion here would be a heartbeat on a pane at rest.
 *   generating  Running, plus work: the core breathes and a short bright arc
 *               sweeps the ring. Only while tokens are actually streaming.
 *   stopping    The ring drains counter-clockwise and the core contracts. Plays
 *               while the unload request is in flight.
 *   error       The ring breaks open at the top right, in the danger color, with
 *               a small dim core. Something went wrong starting or running it.
 *
 * Arrivals (one-shot, never looping, never on first render — gated on an
 * actual change of `state`):
 *   → running    "ignite": the core overshoots to 125% and settles, and one
 *                ripple rolls outward off the bezel.
 *   → idle       the lit core contracts on its spring and the pilot speck fades
 *                back in — plain transitions, no extra animation needed.
 *   → error      "jolt": one short sideways shake.
 *
 * Detail scales with size: the tick bezel only draws at 28px and up, where
 * twelve marks are still marks and not noise.
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";

export type CoreState = "idle" | "loading" | "running" | "generating" | "stopping" | "error";

const props = withDefaults(
  defineProps<{
    state: CoreState;
    size?: number;
    /** The model's memory-ledger tone (0–3); colors the ring and core when lit. */
    tone?: number;
    label?: string;
  }>(),
  { size: 16, tone: 0 },
);

const TICKS = 12;
const detailed = computed(() => props.size >= 28);
const color = computed(() => `rgb(var(--seg-${props.tone % 4}))`);

/** Longest arrival animation; the class is removed after it so it never replays on re-render. */
const ARRIVAL_MS = 750;

/** Arrival animation for the latest transition; cleared once it has played. */
const arrival = ref<"ignite" | "jolt" | null>(null);
/** Bumped per arrival so the same one can replay on a second transition. */
const arrivalKey = ref(0);
let arrivalTimer: ReturnType<typeof setTimeout> | undefined;

// A watcher, not a mount hook: arrivals only ever play on a real change of
// state, never because the component (re)appeared.
watch(
  () => props.state,
  (next, previous) => {
    const kind = next === "running" && previous !== "generating" ? "ignite" : next === "error" ? "jolt" : null;
    if (!kind) return;
    arrival.value = kind;
    arrivalKey.value += 1;
    clearTimeout(arrivalTimer);
    arrivalTimer = setTimeout(() => {
      arrival.value = null;
    }, ARRIVAL_MS);
  },
);
onBeforeUnmount(() => clearTimeout(arrivalTimer));

const DEFAULT_LABEL: Record<CoreState, string> = {
  idle: "Not loaded",
  loading: "Loading",
  running: "Running",
  generating: "Generating",
  stopping: "Stopping",
  error: "Failed",
};
</script>

<template>
  <span
    role="img"
    :aria-label="label ?? DEFAULT_LABEL[state]"
    :class="['core relative inline-grid shrink-0 place-items-center', `is-${state}`, arrival && `arrive-${arrival}`]"
    :style="{ width: `${size}px`, height: `${size}px`, '--core': color }"
  >
    <svg :width="size" :height="size" viewBox="0 0 32 32" fill="none" aria-hidden="true" class="overflow-visible">
      <!-- Bezel ticks: twelve graduations just outside the ring. -->
      <g v-if="detailed" class="ticks">
        <line
          v-for="i in TICKS"
          :key="i"
          x1="16"
          y1="0.8"
          x2="16"
          y2="2.6"
          :transform="`rotate(${(i - 1) * (360 / TICKS)} 16 16)`"
          :style="{ animationDelay: `${((i - 1) / TICKS) * 1.2}s` }"
          class="tick"
        />
      </g>

      <!-- The track: always there, so every state is the same object. -->
      <circle cx="16" cy="16" r="11.5" class="track" />
      <!-- The ring: closed when lit, broken on error, draining when stopping. -->
      <circle cx="16" cy="16" r="11.5" class="ring" pathLength="100" transform="rotate(-90 16 16)" />
      <!-- The comet (loading) / sweep (generating): a short arc with a fading tail. -->
      <g v-if="state === 'loading' || state === 'generating'" class="orbit">
        <circle cx="16" cy="16" r="11.5" class="comet-tail" pathLength="100" transform="rotate(-90 16 16)" />
        <circle cx="16" cy="16" r="11.5" class="comet" pathLength="100" transform="rotate(-90 16 16)" />
      </g>

      <!-- The core. -->
      <g class="core-group">
        <circle cx="16" cy="16" r="10" class="halo" />
        <circle cx="16" cy="16" r="5.5" class="disc" />
      </g>
      <circle cx="16" cy="16" r="1.8" class="pilot" />

      <!-- Ignite ripple: one ring rolling outward, once. -->
      <circle v-if="arrival === 'ignite'" :key="arrivalKey" cx="16" cy="16" r="11.5" class="ripple" />
    </svg>
  </span>
</template>

<style scoped>
.core {
  --track: rgb(var(--subtle) / 0.45);
}
.track {
  stroke: var(--track);
  stroke-width: 1.5;
  transition: stroke 300ms ease;
}
.ring {
  stroke: var(--core);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 0 100;
  opacity: 0;
  transition:
    stroke-dasharray 520ms var(--ease-out),
    opacity 300ms ease,
    stroke 300ms ease;
}
.disc {
  fill: var(--core);
  transform-box: fill-box;
  transform-origin: center;
  transform: scale(0);
  transition: transform 420ms var(--ease-spring);
}
.halo {
  fill: var(--core);
  opacity: 0;
  filter: blur(4px);
  transition: opacity 400ms ease;
}
.pilot {
  fill: rgb(var(--subtle));
  opacity: 0;
  transition: opacity 300ms ease;
}
.tick {
  stroke: rgb(var(--subtle) / 0.5);
  stroke-width: 1;
  stroke-linecap: round;
}

/* idle */
.is-idle .pilot {
  opacity: 0.9;
}

/* loading */
.is-loading .track {
  stroke: rgb(var(--seg-0) / 0.2);
}
.is-loading .disc {
  fill: rgb(var(--seg-0));
  transform: scale(0.45);
  animation: swell 1.6s ease-in-out infinite;
}
.is-loading .orbit {
  transform-origin: 16px 16px;
  animation: orbit 1.2s linear infinite;
}
.is-loading .comet,
.is-generating .comet {
  stroke: rgb(var(--seg-0));
  stroke-width: 2;
  stroke-linecap: round;
  stroke-dasharray: 8 92;
}
.is-loading .comet-tail,
.is-generating .comet-tail {
  stroke: rgb(var(--seg-0) / 0.35);
  stroke-width: 2;
  stroke-dasharray: 0 70 22 8;
  stroke-dashoffset: -8;
}
.is-loading .tick {
  animation: tick-light 1.2s linear infinite;
}

/* running / generating: the ring closes and the core lights */
.is-running .ring,
.is-generating .ring {
  stroke-dasharray: 100 0;
  opacity: 1;
}
.is-running .disc,
.is-generating .disc {
  transform: scale(1);
}
.is-running .halo,
.is-generating .halo {
  opacity: 0.35;
}
.is-running .tick,
.is-generating .tick {
  stroke: var(--core);
  stroke-opacity: 0.45;
}
.is-generating .disc {
  animation: breathe 1.3s ease-in-out infinite;
}
.is-generating .ring {
  opacity: 0.55;
}
.is-generating .comet,
.is-generating .comet-tail {
  stroke: rgb(var(--fg));
}
.is-generating .comet-tail {
  stroke: rgb(var(--fg) / 0.3);
}
.is-generating .orbit {
  transform-origin: 16px 16px;
  animation: orbit 0.9s linear infinite;
}

/* stopping: the ring drains, the core contracts */
.is-stopping .ring {
  stroke: rgb(var(--muted));
  stroke-dasharray: 100 0;
  opacity: 1;
  animation: drain 700ms var(--ease-out) forwards;
}
.is-stopping .disc {
  fill: rgb(var(--muted));
  transform: scale(0.35);
}

/* error: broken ring */
.is-error .ring {
  stroke: rgb(var(--danger));
  stroke-dasharray: 78 22;
  opacity: 1;
}
.is-error .disc {
  fill: rgb(var(--danger));
  transform: scale(0.35);
}

/* arrivals */
.ripple {
  stroke: var(--core);
  stroke-width: 1.5;
  fill: none;
  transform-origin: 16px 16px;
  animation: ripple 700ms var(--ease-out) forwards;
}
.arrive-ignite .disc {
  animation: ignite 520ms var(--ease-spring);
}
.arrive-jolt {
  animation: jolt 360ms ease;
}

@keyframes orbit {
  to {
    transform: rotate(360deg);
  }
}
@keyframes swell {
  0%,
  100% {
    transform: scale(0.4);
  }
  50% {
    transform: scale(0.6);
  }
}
@keyframes breathe {
  0%,
  100% {
    transform: scale(0.9);
  }
  50% {
    transform: scale(1.12);
  }
}
@keyframes tick-light {
  0%,
  8% {
    stroke: rgb(var(--seg-0));
    stroke-opacity: 1;
  }
  40%,
  100% {
    stroke: rgb(var(--subtle) / 0.5);
    stroke-opacity: 1;
  }
}
@keyframes drain {
  to {
    stroke-dasharray: 0 100;
    opacity: 0.2;
  }
}
@keyframes ignite {
  0% {
    transform: scale(0.2);
  }
  60% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes ripple {
  from {
    opacity: 0.8;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(1.55);
  }
}
@keyframes jolt {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-2px);
  }
  50% {
    transform: translateX(2px);
  }
  75% {
    transform: translateX(-1px);
  }
}
</style>
