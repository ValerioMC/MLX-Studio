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
  <!-- The one bold instrument on Overview: a gauge, not a generic progress bar.
       A pill housing (rounded-full, however tall) with an inset track shadow
       for depth, each segment lit from the top like a physical bevel rather
       than a flat fill, and a soft accent glow under the housing itself so the
       whole thing reads as lit rather than drawn. -->
  <div
    role="img"
    :aria-label="label"
    :class="
      cn(
        'relative flex w-full gap-[2px] overflow-hidden rounded-full bg-muted p-[2px] shadow-[inset_0_1px_3px_rgb(0_0_0/0.35)] transition-shadow duration-500',
        overflow ? 'ring-1 ring-destructive' : 'shadow-[0_0_20px_-6px_rgb(var(--accent)/0.45),inset_0_1px_3px_rgb(0_0_0/0.35)]',
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
          'relative h-full min-w-[2px] overflow-hidden rounded-full transition-[flex-grow] duration-500 ease-out',
          segmentClass(segment),
          segment.kind === 'pending' && 'animate-pulse',
        )
      "
      :style="{ flexGrow: segment.bytes, flexBasis: 0 }"
    >
      <!-- Top-lit sheen: the same bevel on every segment regardless of its
           color, so the bar reads as one physical object, not N flat swatches. -->
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 via-white/0 to-black/10"
      />
    </div>
  </div>
</template>
