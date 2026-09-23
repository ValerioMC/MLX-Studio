<script setup lang="ts">
/**
 * On/off. The knob travels on a spring (a small overshoot as it lands) and
 * the track lights in the signal color, with a faint glow, only when on — so
 * "on" reads as *powered*, not just as a different fill.
 */
defineProps<{ modelValue: boolean; label: string; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label"
    :disabled="disabled"
    class="no-drag relative inline-flex h-[20px] w-[34px] shrink-0 items-center rounded-full ring-1 ring-inset transition-[background-color,box-shadow] duration-200 disabled:opacity-45"
    :class="
      modelValue
        ? 'bg-accent ring-accent-deep/60 shadow-[0_0_14px_-3px_rgb(var(--accent)/0.6)]'
        : 'bg-canvas/70 ring-line-strong shadow-[inset_0_1px_2px_rgb(0_0_0/0.4)]'
    "
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      aria-hidden="true"
      class="inline-block h-[14px] w-[14px] rounded-full shadow-[0_1px_2px_rgb(0_0_0/0.4)] transition-[transform,background-color] duration-300 ease-spring"
      :class="modelValue ? 'translate-x-[17px] bg-accent-ink' : 'translate-x-[3px] bg-muted'"
    />
  </button>
</template>
