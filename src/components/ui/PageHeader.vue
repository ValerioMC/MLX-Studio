<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <header class="flex min-h-[2.5rem] items-center justify-between gap-4 pb-5">
    <h1 class="text-xl font-semibold">{{ title }}</h1>
    <div v-if="$slots.default" class="flex items-center gap-2">
      <slot />
    </div>
  </header>
</template>
