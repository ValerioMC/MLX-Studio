<script setup lang="ts">
/**
 * Calm blank space, not an error. A dashed outline and generous padding, and
 * an icon slot whose default is the app's own drawing — an empty bezel with
 * its tick marks, the ModelCore ring with nothing in it — not a stock picture.
 */
defineProps<{ title: string }>();
</script>

<template>
  <div
    class="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong/80 bg-surface/30 px-8 py-14 text-center"
  >
    <div class="mb-2 text-subtle">
      <slot name="icon">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" aria-hidden="true">
          <circle cx="22" cy="22" r="15" stroke="currentColor" stroke-opacity="0.5" />
          <circle cx="22" cy="22" r="20.5" stroke="currentColor" stroke-opacity="0.18" stroke-dasharray="1 4.35" />
          <circle cx="22" cy="22" r="3" fill="currentColor" fill-opacity="0.5" />
        </svg>
      </slot>
    </div>
    <p class="text-md font-semibold">{{ title }}</p>
    <p v-if="$slots.default" class="max-w-[44ch] text-sm text-muted"><slot /></p>
    <div v-if="$slots.action" class="mt-3"><slot name="action" /></div>
  </div>
</template>
