<script setup lang="ts">
import { cn } from "@/lib/utils";
import { onBeforeUnmount, ref, watch } from "vue";

/** A panel anchored under its trigger; outside clicks and Escape close it. */
const props = defineProps<{ open: boolean; label: string; panelClass?: string }>();
const emit = defineEmits<{ close: [] }>();
const rootRef = ref<HTMLDivElement | null>(null);

function onPointer(event: MouseEvent): void {
  if (!rootRef.value?.contains(event.target as Node)) emit("close");
}
function onKey(event: KeyboardEvent): void {
  if (event.key === "Escape") emit("close");
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      document.addEventListener("mousedown", onPointer);
      document.addEventListener("keydown", onKey);
    } else {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    }
  },
);
onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onPointer);
  document.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div ref="rootRef" class="relative">
    <slot name="trigger" />
    <Transition name="popover-pop">
      <div
        v-if="open"
        role="dialog"
        :aria-label="label"
        :class="cn('absolute right-0 top-full z-overlay mt-1.5 w-[22rem] rounded-lg bg-card p-4 shadow-dialog', panelClass)"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>
