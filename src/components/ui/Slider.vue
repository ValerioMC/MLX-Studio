<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ modelValue: number; min: number; max: number; step: number; label: string }>();
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const filled = computed(() =>
  props.max > props.min ? ((props.modelValue - props.min) / (props.max - props.min)) * 100 : 0,
);
</script>

<template>
  <!-- A range input whose filled track shows the value. -->
  <input
    type="range"
    :aria-label="label"
    :min="min"
    :max="max"
    :step="step"
    :value="modelValue"
    :style="{ '--filled': `${filled}%` }"
    class="no-drag h-4 w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,rgb(var(--accent))_var(--filled),rgb(var(--input))_var(--filled))] [&::-webkit-slider-thumb]:-mt-[6.5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/10 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow"
    @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
  />
</template>
