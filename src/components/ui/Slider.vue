<script setup lang="ts">
import { computed } from "vue";

/**
 * A range input drawn as an instrument: a recessed track, a lit fill up to
 * the value, and a machined thumb with a signal-colored core. `ticks` draws
 * that many evenly spaced graduations under the track.
 */
const props = withDefaults(
  defineProps<{ modelValue: number; min: number; max: number; step: number; label: string; ticks?: number }>(),
  { ticks: 0 },
);
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const filled = computed(() =>
  props.max > props.min ? ((props.modelValue - props.min) / (props.max - props.min)) * 100 : 0,
);
</script>

<template>
  <div class="relative">
    <input
      type="range"
      :aria-label="label"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :style="{ '--filled': `${filled}%` }"
      class="slider no-drag h-5 w-full cursor-pointer appearance-none bg-transparent"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
    />
    <div v-if="ticks > 1" aria-hidden="true" class="pointer-events-none flex justify-between px-[7px]">
      <span v-for="i in ticks" :key="i" class="h-1 w-px bg-line-strong" />
    </div>
  </div>
</template>

<style scoped>
.slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 999px;
  background:
    linear-gradient(to right, rgb(var(--accent)) var(--filled), transparent var(--filled)),
    rgb(var(--canvas) / 0.7);
  box-shadow:
    inset 0 1px 2px rgb(0 0 0 / 0.45),
    0 0 0 1px rgb(var(--line));
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  margin-top: -6px;
  height: 16px;
  width: 16px;
  border-radius: 999px;
  background: radial-gradient(circle, rgb(var(--accent)) 0 2.5px, rgb(var(--fg)) 3px);
  box-shadow:
    0 1px 3px rgb(0 0 0 / 0.5),
    0 0 0 1px rgb(0 0 0 / 0.15);
  transition:
    transform 160ms var(--ease-spring),
    box-shadow 160ms ease;
}
.slider:hover::-webkit-slider-thumb {
  transform: scale(1.12);
}
.slider:active::-webkit-slider-thumb {
  transform: scale(0.96);
  box-shadow:
    0 1px 3px rgb(0 0 0 / 0.5),
    0 0 0 5px rgb(var(--accent) / 0.18);
}
.slider:focus-visible {
  outline: none;
}
.slider:focus-visible::-webkit-slider-thumb {
  box-shadow:
    0 1px 3px rgb(0 0 0 / 0.5),
    0 0 0 2px rgb(var(--canvas)),
    0 0 0 4px rgb(var(--accent));
}
</style>
