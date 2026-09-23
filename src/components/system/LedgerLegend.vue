<script setup lang="ts">
import { cn } from "@/lib/utils";
import { bytes } from "@/lib/format";
import type { MemoryLedger } from "@/lib/memory";
import { segmentClass } from "./segmentClass";

defineProps<{ ledger: MemoryLedger }>();
</script>

<template>
  <!-- Legend under the bar: what each segment is and how much it takes. -->
  <ul class="flex flex-wrap gap-x-5 gap-y-1.5">
    <li v-for="segment in ledger.segments" :key="segment.key" class="flex min-w-0 items-center gap-1.5 text-sm">
      <span
        aria-hidden="true"
        :class="cn('h-2.5 w-2.5 shrink-0 rounded-[3px]', segmentClass(segment), segment.kind === 'free' && 'border border-input')"
      />
      <span class="max-w-[18ch] truncate text-muted-foreground">{{ segment.label }}</span>
      <span class="tabular font-medium">{{ bytes(segment.bytes) }}</span>
    </li>
  </ul>
</template>
