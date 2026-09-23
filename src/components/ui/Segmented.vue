<script setup lang="ts" generic="T extends string">
import { computed } from "vue";
import { cn } from "@/lib/utils";

/**
 * One choice out of a few, side by side. The selected thumb is a single
 * element that *slides* to the new option rather than each option lighting
 * up in place — the eye follows the move, so the change is never missed.
 * The thumb's 6px radius is not a third token: it is the control radius minus
 * the track's inset, so the two curves stay concentric.
 */
const props = defineProps<{
  modelValue: T;
  options: readonly { value: T; label: string }[];
  label: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: T] }>();

const index = computed(() => Math.max(0, props.options.findIndex((o) => o.value === props.modelValue)));

function onKey(event: KeyboardEvent): void {
  const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  const next = props.options[(index.value + step + props.options.length) % props.options.length];
  if (next) emit("update:modelValue", next.value);
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="no-drag relative inline-grid self-start rounded-control bg-canvas/60 p-[3px] shadow-[inset_0_1px_2px_rgb(0_0_0/0.35)] ring-1 ring-inset ring-line"
    :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }"
    @keydown="onKey"
  >
    <span
      aria-hidden="true"
      class="absolute bottom-[3px] left-[3px] top-[3px] rounded-[6px] bg-raised shadow-lift ring-1 ring-inset ring-line-strong/70 transition-transform duration-300 ease-out"
      :style="{
        width: `calc((100% - 6px) / ${options.length})`,
        transform: `translateX(${index * 100}%)`,
      }"
    />
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue"
      :tabindex="option.value === modelValue ? 0 : -1"
      :class="
        cn(
          'relative z-[1] h-[26px] rounded-[6px] px-3.5 text-sm font-medium transition-colors duration-150',
          option.value === modelValue ? 'text-fg' : 'text-muted hover:text-fg',
        )
      "
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
