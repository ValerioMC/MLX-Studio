<script setup lang="ts">
defineProps<{ label: string; active: boolean }>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    :aria-pressed="active"
    class="no-drag h-7 rounded-md px-2.5 text-sm font-medium transition-colors"
    :class="active ? 'bg-accent/12 text-accent' : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
    @click="$emit('click')"
  >
    {{ label }}
  </button>
</template>
