<script setup lang="ts">
/**
 * MemoryCells — the dial's compact sibling, for places too small for a dial
 * (the rail, the Start dialog). Memory as a strip of equal cells, one per GB
 * on most Macs, like the segments of a level meter: a model's size is a
 * *count* of lit cells in its color, which reads faster than a fraction of a
 * bar. The cells share the dial's language — model tones, dim system memory,
 * hatched reserve, empty free cells.
 *
 * A pending model (Start dialog) is drawn as outlined cells that pulse —
 * the only motion here, and only while that model is still a proposal. What
 * it needs beyond the total spills past the end as danger-outlined cells.
 */
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { bytes } from "@/lib/format";
import { memoryCells, type MemoryLedger } from "@/lib/memory";
import { segmentClass } from "@/components/system/segmentClass";

const props = withDefaults(
  defineProps<{ ledger: MemoryLedger; maxCells?: number; height?: "sm" | "md" }>(),
  { maxCells: 48, height: "md" },
);

const strip = computed(() => memoryCells(props.ledger, props.maxCells));
const label = computed(() => props.ledger.segments.map((s) => `${s.label} ${bytes(s.bytes)}`).join(", "));
const names = computed(() => new Map(props.ledger.segments.map((s) => [s.key, `${s.label}: ${bytes(s.bytes)}`])));
</script>

<template>
  <div role="img" :aria-label="label" :class="cn('flex w-full', height === 'sm' ? 'h-2 gap-[2px]' : 'h-4 gap-[3px]')">
    <span
      v-for="(cell, i) in strip.cells"
      :key="i"
      :title="cell.kind === 'overflow' ? 'Does not fit' : names.get(cell.segmentKey)"
      :class="
        cn(
          'min-w-0 flex-1 rounded-full transition-colors duration-500',
          segmentClass(cell),
          cell.kind === 'pending' && 'animate-[pulse_1.4s_ease-in-out_infinite]',
          cell.kind === 'model' && 'shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]',
        )
      "
    />
  </div>
</template>
