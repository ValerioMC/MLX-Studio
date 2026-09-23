<script setup lang="ts">
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-vue-next";
import { nextTick, onBeforeUnmount, ref } from "vue";

const props = withDefaults(defineProps<{ text: string; label?: string; showLabel?: boolean }>(), {
  label: "Copy",
  showLabel: false,
});

/** How long the check mark stays before the copy icon returns. */
const CONFIRM_MS = 1400;
/** Length of the ring-flash animation (see .animate-flash-ring). */
const FLASH_MS = 520;

const copied = ref(false);
const flashing = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
let flashTimer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => {
  clearTimeout(timer);
  clearTimeout(flashTimer);
});

/** Restarts the ring-flash, so a second copy flashes again. */
async function flash(): Promise<void> {
  flashing.value = false;
  await nextTick();
  flashing.value = true;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flashing.value = false;
  }, FLASH_MS);
}

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.text);
  } catch {
    return; // clipboard permission denied: nothing was copied, so no confirmation
  }
  copied.value = true;
  void flash();
  clearTimeout(timer);
  timer = setTimeout(() => {
    copied.value = false;
  }, CONFIRM_MS);
}
</script>

<template>
  <!-- Micro-feedback, not a toast: the icon pops from two sheets to a check,
       and a soft ring flashes outward from the button — the confirmation lands
       exactly where the eye already is. The root is deliberately not
       `relative`, so callers can position it (absolute) without a fight. -->
  <button
    type="button"
    :aria-label="copied ? 'Copied' : label"
    :title="copied ? 'Copied' : label"
    :class="
      cn(
        'no-drag inline-flex h-control-sm shrink-0 items-center gap-1.5 rounded-control px-1.5 text-xs font-medium text-muted transition-colors hover:bg-fg/[0.06] hover:text-fg',
        copied && 'text-accent-text',
        flashing && 'animate-flash-ring',
      )
    "
    @click="copy"
  >
    <span class="relative grid h-3.5 w-3.5 place-items-center">
      <Transition name="swap" mode="out-in">
        <Check v-if="copied" class="h-3.5 w-3.5" :stroke-width="2.5" />
        <Copy v-else class="h-3.5 w-3.5" />
      </Transition>
    </span>
    <span v-if="showLabel">{{ copied ? "Copied" : label }}</span>
  </button>
</template>
