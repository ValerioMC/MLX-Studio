<script setup lang="ts">
import { cn } from "@/lib/utils";
import { X } from "lucide-vue-next";
import { onBeforeUnmount, onMounted, ref, useId } from "vue";
import Button from "./Button.vue";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog. Escape and the scrim close it, Tab stays inside, focus moves
 * to the element marked `data-autofocus` (else the first focusable) and goes
 * back to whatever opened it on close.
 *
 * Callers mount it with v-if; the "dialog" motion runs on `appear`, so every
 * dialog in the app opens and closes the same way.
 */
const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    /** False while an action is in flight that closing would orphan. */
    dismissible?: boolean;
    panelClass?: string;
    role?: "dialog" | "alertdialog";
  }>(),
  { dismissible: true, role: "dialog" },
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
    <Transition name="scrim" appear>
      <!-- The room dims and softens behind the dialog rather than going black:
           you should still feel where you were. -->
      <div
        class="no-drag fixed inset-0 z-modal flex items-center justify-center bg-canvas/60 p-8 backdrop-blur-[6px]"
        @mousedown="onScrimClick"
      >
        <Transition name="dialog" appear>
          <div
            ref="panelRef"
            :role="role"
            aria-modal="true"
            :aria-labelledby="titleId"
            :aria-describedby="description || $slots.description ? descriptionId : undefined"
            tabindex="-1"
            :class="
              cn(
                'edge-lit flex max-h-[86vh] w-[30rem] max-w-full flex-col rounded-card border border-line bg-surface text-fg shadow-modal outline-none',
                panelClass,
              )
            "
          >
            <header class="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
              <div class="min-w-0">
                <h2 :id="titleId" class="text-lg font-semibold">{{ title }}</h2>
                <p v-if="description || $slots.description" :id="descriptionId" class="mt-1 text-sm text-muted">
                  <slot name="description">{{ description }}</slot>
                </p>
              </div>
              <Button v-if="dismissible" variant="ghost" size="icon-sm" aria-label="Close" class="-mr-2 -mt-0.5" @click="emit('close')">
                <X />
              </Button>
            </header>
            <div v-if="$slots.default" class="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
              <slot />
            </div>
            <footer
              v-if="$slots.footer"
              class="flex items-center justify-end gap-2 rounded-b-card border-t border-line bg-canvas/40 px-6 py-3.5"
            >
              <slot name="footer" />
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
