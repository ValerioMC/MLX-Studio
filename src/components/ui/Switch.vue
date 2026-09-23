<script setup lang="ts">
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
    class="no-drag relative inline-flex h-[18px] w-[30px] shrink-0 items-center rounded-full transition-colors disabled:opacity-45"
    :class="modelValue ? 'bg-accent' : 'bg-input'"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      aria-hidden="true"
      class="inline-block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-150"
      :class="modelValue ? 'translate-x-[14px]' : 'translate-x-[2px]'"
    />
  </button>
</template>
