<script setup lang="ts">
/** A settings group: a panel with its name and purpose on the left, controls on the right. */
defineProps<{ title: string; description: string }>();
</script>

<template>
  <section class="edge-lit grid grid-cols-1 gap-x-10 gap-y-4 rounded-card border border-line bg-surface/70 p-6 shadow-lift md:grid-cols-[14rem_minmax(0,1fr)]">
    <div>
      <h2 class="text-md font-semibold">{{ title }}</h2>
      <p class="pt-1 text-sm text-muted">{{ description }}</p>
    </div>
    <div class="flex min-w-0 flex-col gap-3">
      <slot />
    </div>
  </section>
</template>
