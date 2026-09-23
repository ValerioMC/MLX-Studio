<script setup lang="ts">
import { cn } from "@/lib/utils";
import { onBeforeUnmount, ref, watch } from "vue";

/**
 * A panel anchored under its trigger: outside clicks and Escape close it, and
 * it scales from the corner it hangs from (the "popover" motion).
 */
const props = withDefaults(
  defineProps<{ open: boolean; label: string; panelClass?: string; align?: "start" | "end" }>(),
  { align: "end" },
);
const emit = defineEmits<{ close: [] }>();
const rootRef = ref<HTMLDivElement | null>(null);

function onPointer(event: MouseEvent): void {
  if (!rootRef.value?.contains(event.target as Node)) emit("close");
}
function onKey(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation();
    emit("close");
  }
}

function listen(on: boolean): void {
  if (on) {
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey, true);
  } else {
    document.removeEventListener("mousedown", onPointer);
    document.removeEventListener("keydown", onKey, true);
  }
}

watch(() => props.open, listen);
onBeforeUnmount(() => listen(false));
</script>

<template>
  <div ref="rootRef" class="relative">
    <slot name="trigger" />
    <Transition name="popover">
      <div
        v-if="open"
        role="dialog"
        :aria-label="label"
        :class="
          cn(
            'edge-lit absolute top-full z-overlay mt-2 w-[22rem] rounded-card border border-line bg-surface/95 p-4 shadow-modal backdrop-blur-xl',
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            panelClass,
          )
        "
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>
