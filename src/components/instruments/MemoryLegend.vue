<script setup lang="ts">
import { cn } from "@/lib/utils";
import { bytes } from "@/lib/format";
import type { MemoryLedger } from "@/lib/memory";
import { segmentClass } from "@/components/system/segmentClass";

/**
 * The dial's key: one row per segment, with its size and share. Hovering a
 * row lights the matching arc on the dial and vice versa (`hovered` is the
 * same ref on both), so the legend is a way to *point* at the dial.
 */
const props = withDefaults(defineProps<{ ledger: MemoryLedger; hovered?: string | null }>(), { hovered: null });
const emit = defineEmits<{ "update:hovered": [key: string | null] }>();

function share(value: number): string {
  return `${Math.round((value / (props.ledger.totalBytes || 1)) * 100)}%`;
}
</script>

<template>
  <ul class="flex flex-col">
    <li
      v-for="segment in ledger.segments"
      :key="segment.key"
      :class="
        cn(
          'grid h-row grid-cols-[14px_minmax(0,1fr)_auto_3rem] items-center gap-3 rounded-control px-2.5 text-base transition-[background-color,opacity] duration-150',
          hovered === segment.key && 'bg-fg/[0.05]',
          hovered && hovered !== segment.key && 'opacity-50',
        )
      "
      @mouseenter="emit('update:hovered', segment.key)"
      @mouseleave="emit('update:hovered', null)"
    >
      <span aria-hidden="true" :class="cn('h-2.5 w-2.5 rounded-[3px]', segmentClass(segment))" />
      <span :class="cn('truncate', segment.kind === 'model' ? 'font-medium text-fg' : 'text-muted')">
        {{ segment.label }}
      </span>
      <span class="tabular font-medium">{{ bytes(segment.bytes) }}</span>
      <span class="tabular text-right text-sm text-subtle">{{ share(segment.bytes) }}</span>
    </li>
  </ul>
</template>
