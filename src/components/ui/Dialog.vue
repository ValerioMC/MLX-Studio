<script setup lang="ts">
import { cn } from "@/lib/utils";
import { X } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref, useId } from "vue";
import Button from "./Button.vue";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog: Escape and the scrim close it, Tab stays inside, and focus
 * returns to whatever opened it.
 */
const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    /** False while an action is in flight that closing would orphan. */
    dismissible?: boolean;
    panelClass?: string;
  }>(),
  { dismissible: true },
);
const emit = defineEmits<{ close: [] }>();

const panelRef = ref<HTMLDivElement | null>(null);
const titleId = `dialog-title-${useId()}`;
const descriptionId = `dialog-desc-${useId()}`;
let opener: HTMLElement | null = null;

function onKey(event: KeyboardEvent): void {
  if (event.key === "Escape" && props.dismissible) {
    event.stopPropagation();
    emit("close");
    return;
  }
  const panel = panelRef.value;
  if (event.key !== "Tab" || !panel) return;
  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

onMounted(() => {
  opener = document.activeElement as HTMLElement | null;
  const panel = panelRef.value;
  const first = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
  (first ?? panel)?.focus();
  document.addEventListener("keydown", onKey, true);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKey, true);
  opener?.focus?.();
});

function onScrimClick(event: MouseEvent): void {
  if (event.target === event.currentTarget && props.dismissible) emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div
      class="no-drag fixed inset-0 z-modal flex animate-scrim-in items-center justify-center bg-black/45 p-6 backdrop-blur-[2px]"
      @mousedown="onScrimClick"
    >
      <div
        ref="panelRef"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        :aria-describedby="description || $slots.description ? descriptionId : undefined"
        tabindex="-1"
        :class="
          cn(
            'flex max-h-[88vh] w-[30rem] max-w-full animate-dialog-in flex-col rounded-lg bg-card text-card-foreground shadow-dialog outline-none',
            panelClass,
          )
        "
      >
        <div class="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div class="min-w-0">
            <h2 :id="titleId" class="text-lg font-semibold">{{ title }}</h2>
            <p v-if="description || $slots.description" :id="descriptionId" class="mt-0.5 text-sm text-muted-foreground">
              <slot name="description">{{ description }}</slot>
            </p>
          </div>
          <Button v-if="dismissible" variant="ghost" size="icon-sm" aria-label="Close" class="-mr-1.5" @click="emit('close')">
            <X />
          </Button>
        </div>
        <div v-if="$slots.default" class="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <slot />
        </div>
        <div v-if="$slots.footer" class="flex items-center justify-end gap-2 border-t px-5 py-3">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
