<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <!-- Calm blank space, not an error: a dashed border and generous padding. -->
  <div class="flex flex-col items-start gap-1.5 rounded-lg border border-dashed px-6 py-8">
    <p class="text-md font-medium">{{ title }}</p>
    <p v-if="$slots.default" class="max-w-[46ch] text-sm text-muted-foreground"><slot /></p>
    <div v-if="$slots.action" class="mt-2"><slot name="action" /></div>
  </div>
</template>
