<script setup lang="ts">
import { gigabytes } from "@/lib/format";
import type { MemoryLedger } from "@/lib/memory";

/** The headline figure: what a new model can take right now. */
withDefaults(defineProps<{ ledger: MemoryLedger; size?: "hero" | "compact" }>(), { size: "hero" });
</script>

<template>
  <p v-if="size === 'compact'" class="text-xs text-muted-foreground">
    <span class="tabular font-semibold text-foreground">{{ gigabytes(ledger.freeForModelsBytes) }} GB</span> free for
    models
  </p>
  <p v-else class="flex items-baseline gap-3">
    <span class="figure text-3xl font-semibold">
      {{ gigabytes(ledger.freeForModelsBytes) }}
      <span class="ml-1 text-xl font-medium text-muted-foreground">GB</span>
    </span>
    <span class="text-md text-muted-foreground">
      free for models, of {{ gigabytes(ledger.totalBytes) }} GB unified memory
    </span>
  </p>
</template>
