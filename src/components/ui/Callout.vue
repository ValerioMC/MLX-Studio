<script setup lang="ts">
import { computed } from "vue";
import { CircleAlert, Info, TriangleAlert } from "lucide-vue-next";
import { cn } from "@/lib/utils";

/**
 * A sentence the user has to read, in context: an error beside the thing that
 * failed, a warning beside the thing that is slow. Danger announces itself to
 * a screen reader (role="alert"); the others are polite status.
 */
const props = withDefaults(defineProps<{ tone?: "danger" | "warn" | "info" }>(), { tone: "danger" });

const TONES = {
  danger: { box: "border-danger-line bg-danger-soft", icon: "text-danger", glyph: CircleAlert },
  warn: { box: "border-warn-line bg-warn-soft", icon: "text-warn", glyph: TriangleAlert },
  info: { box: "border-line bg-fg/[0.03]", icon: "text-muted", glyph: Info },
} as const;
const tone = computed(() => TONES[props.tone]);
</script>

<template>
  <div
    :role="props.tone === 'danger' ? 'alert' : 'status'"
    :class="cn('flex items-start gap-2.5 rounded-control border px-3.5 py-2.5 text-sm text-fg', tone.box)"
  >
    <component :is="tone.glyph" :class="cn('mt-px h-4 w-4 shrink-0', tone.icon)" aria-hidden="true" />
    <div class="min-w-0 flex-1"><slot /></div>
    <div v-if="$slots.action" class="-my-1 shrink-0"><slot name="action" /></div>
  </div>
</template>
