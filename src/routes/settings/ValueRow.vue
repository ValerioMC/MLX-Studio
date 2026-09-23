<script setup lang="ts">
import CopyButton from "@/components/ui/CopyButton.vue";

/** A value you copy somewhere else: a label, the value in a recessed mono well, and copy. */
defineProps<{ label: string; value: string }>();
</script>

<template>
  <div class="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3">
    <span class="text-sm text-muted">{{ label }}</span>
    <div class="field flex h-control items-center gap-2 rounded-control pl-3 pr-1">
      <code class="selectable min-w-0 flex-1 truncate font-mono text-sm">{{ value }}</code>
      <CopyButton :text="value" :label="`Copy ${label.toLowerCase()}`" />
    </div>
  </div>
</template>
