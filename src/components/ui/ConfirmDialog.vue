<script setup lang="ts">
import { TriangleAlert } from "lucide-vue-next";
import Dialog from "./Dialog.vue";
import Button from "./Button.vue";

/**
 * Yes/no for anything destructive. The default slot explains; the `blast`
 * slot is the blast radius — one concrete sentence on what gets destroyed,
 * set apart on a hazard-striped strip so it can't be skimmed past. Focus
 * lands on Cancel, the safe choice, never on the destructive button.
 */
withDefaults(defineProps<{ title: string; confirmLabel: string; busy?: boolean }>(), { busy: false });
const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <Dialog :title="title" role="alertdialog" :dismissible="!busy" panel-class="w-[28rem]" @close="emit('cancel')">
    <div class="flex flex-col gap-4 text-base text-muted">
      <div v-if="$slots.default"><slot /></div>
      <div
        v-if="$slots.blast"
        class="relative flex items-start gap-2.5 overflow-hidden rounded-control border border-danger-line bg-danger-soft px-3.5 py-3 text-sm text-fg"
      >
        <!-- Hazard stripes along the left edge: the only striped thing in the
             app, so it only ever means "this cannot be undone". -->
        <span
          aria-hidden="true"
          class="absolute inset-y-0 left-0 w-1.5 bg-[repeating-linear-gradient(-45deg,rgb(var(--danger))_0_4px,transparent_4px_8px)]"
        />
        <TriangleAlert class="ml-1.5 mt-px h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <p><slot name="blast" /></p>
      </div>
    </div>
    <template #footer>
      <Button variant="secondary" :disabled="busy" data-autofocus @click="emit('cancel')">Cancel</Button>
      <Button variant="danger" :loading="busy" @click="emit('confirm')">{{ confirmLabel }}</Button>
    </template>
  </Dialog>
</template>
