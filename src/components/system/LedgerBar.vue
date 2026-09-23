<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { bytes } from "@/lib/format";
import type { MemoryLedger } from "@/lib/memory";
import { segmentClass } from "./segmentClass";

/** The bar itself: the Mac's whole unified memory, left to right. */
const props = withDefaults(
  defineProps<{
    ledger: MemoryLedger;
    height?: string;
    /** Marks the right edge red: a pending model does not fit. */
    overflow?: boolean;
  }>(),
  { height: "h-7", overflow: false },
);

const label = computed(() => props.ledger.segments.map((s) => `${s.label} ${bytes(s.bytes)}`).join(", "));
</script>

<template>
  <div
    role="img"
    :aria-label="label"
    :class="
      cn(
        'flex w-full gap-[2px] overflow-hidden rounded-[5px] bg-muted p-[2px]',
        overflow && 'ring-1 ring-destructive',
        height,
      )
    "
  >
    <div
      v-for="segment in ledger.segments"
      :key="segment.key"
      :title="`${segment.label}: ${bytes(segment.bytes)}`"
      :class="
        cn(
          'h-full min-w-[2px] rounded-[3px] transition-[flex-grow] duration-500 ease-out',
          segmentClass(segment),
          segment.kind === 'pending' && 'animate-pulse',
        )
      "
      :style="{ flexGrow: segment.bytes, flexBasis: 0 }"
    />
  </div>
</template>
