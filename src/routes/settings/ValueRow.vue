<script setup lang="ts">
import CopyButton from "@/components/ui/CopyButton.vue";

defineProps<{ label: string; value: string }>();
</script>

<template>
  <div class="flex items-center gap-3 text-base">
    <span class="w-20 shrink-0 text-muted-foreground">{{ label }}</span>
    <code class="min-w-0 flex-1 truncate rounded-md bg-muted/70 px-2 py-1 font-mono text-xs">{{ value }}</code>
    <CopyButton :text="value" :label="`Copy ${label.toLowerCase()}`" />
  </div>
</template>
