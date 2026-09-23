<script setup lang="ts">
import Dialog from "./Dialog.vue";
import Button from "./Button.vue";

/** Yes/no for destructive actions, in place of window.confirm. */
withDefaults(defineProps<{ title: string; confirmLabel: string; busy?: boolean }>(), { busy: false });
const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <Dialog :title="title" :dismissible="!busy" panel-class="w-[26rem]" @close="emit('cancel')">
    <div class="text-base text-muted-foreground">
      <slot />
    </div>
    <template #footer>
      <Button variant="secondary" :disabled="busy" @click="emit('cancel')">Cancel</Button>
      <Button variant="danger" :loading="busy" data-autofocus @click="emit('confirm')">{{ confirmLabel }}</Button>
    </template>
  </Dialog>
</template>
