<script setup lang="ts">
/**
 * The top of every page: a small eyebrow that places you (what this page is
 * about, in muted text), the title, and actions on the right. The title is
 * large and pulled in; the eyebrow is ordinary case — no tracked capitals.
 */
defineProps<{ title: string; eyebrow?: string }>();
</script>

<template>
  <header class="flex min-h-[4.5rem] flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-7">
    <div class="min-w-0">
      <p v-if="eyebrow || $slots.eyebrow" class="flex items-center gap-2 pb-1.5 text-sm text-muted">
        <slot name="eyebrow">{{ eyebrow }}</slot>
      </p>
      <h1 class="text-3xl font-semibold">{{ title }}</h1>
    </div>
    <div v-if="$slots.default" class="flex items-center gap-2 pb-1">
      <slot />
    </div>
  </header>
</template>
