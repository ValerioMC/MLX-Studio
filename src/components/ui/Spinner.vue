<script setup lang="ts">
/**
 * The app's own spinner: a short bright arc chasing around a faint track, the
 * same ring geometry as ModelCore so "busy" looks like part of one family of
 * instruments rather than a library glyph. It only exists while something is
 * actually in flight — callers mount it with v-if, never hide it.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 15 });
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="none"
    aria-hidden="true"
    class="shrink-0 animate-[spin_0.8s_linear_infinite]"
  >
    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-opacity="0.2" stroke-width="2" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
  </svg>
</template>
