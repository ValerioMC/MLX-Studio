<script setup lang="ts">
import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-vue-next";
import { onBeforeUnmount, ref } from "vue";

const props = withDefaults(defineProps<{ text: string; label?: string; showLabel?: boolean }>(), {
  label: "Copy",
  showLabel: false,
});

const copied = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
onBeforeUnmount(() => clearTimeout(timer));

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.text);
  } catch {
    return; // clipboard permission denied: nothing was copied, so no confirmation
  }
  copied.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    copied.value = false;
  }, 1400);
}
</script>

<template>
  <button
    type="button"
    :aria-label="copied ? 'Copied' : label"
    :title="copied ? 'Copied' : label"
    :class="
      cn(
        'no-drag inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
      )
    "
    @click="copy"
  >
    <Check v-if="copied" class="h-3.5 w-3.5 text-positive" />
    <Copy v-else class="h-3.5 w-3.5" />
    <span v-if="showLabel">{{ copied ? "Copied" : label }}</span>
  </button>
</template>
