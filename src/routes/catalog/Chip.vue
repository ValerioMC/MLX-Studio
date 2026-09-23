<script setup lang="ts">
import { Check } from "lucide-vue-next";
import { cn } from "@/lib/utils";

/** A filter you toggle. On, it lights in the signal wash and a check pops in; the chip grows to fit it. */
defineProps<{ label: string; active: boolean }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    :aria-pressed="active"
    :class="
      cn(
        'no-drag inline-flex h-control-sm items-center gap-1 rounded-full px-3 text-sm font-medium ring-1 ring-inset transition-[background-color,color,box-shadow] duration-150',
        active
          ? 'bg-accent-soft pl-2 text-accent-text ring-accent-line'
          : 'text-muted ring-line hover:bg-fg/[0.04] hover:text-fg hover:ring-line-strong',
      )
    "
    @click="$emit('click')"
  >
    <Transition name="swap">
      <Check v-if="active" class="h-3.5 w-3.5" :stroke-width="2.6" aria-hidden="true" />
    </Transition>
    {{ label }}
  </button>
</template>
