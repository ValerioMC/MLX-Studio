<script setup lang="ts" generic="T extends string">
import { cn } from "@/lib/utils";

defineProps<{
  modelValue: T;
  options: readonly { value: T; label: string }[];
  label: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: T] }>();
</script>

<template>
  <!-- One choice out of a few, shown side by side. -->
  <div role="radiogroup" :aria-label="label" class="no-drag inline-flex self-start rounded-md bg-muted p-0.5">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue"
      :class="
        cn(
          'h-6 rounded-sm px-2.5 text-sm font-medium transition-colors',
          option.value === modelValue
            ? 'bg-card text-foreground shadow-float'
            : 'text-muted-foreground hover:text-foreground',
        )
      "
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
