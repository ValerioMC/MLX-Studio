<script setup lang="ts">
import { computed } from "vue";
import { bytes } from "@/lib/format";
import Tag from "@/components/ui/Tag.vue";
import type { CatalogModel, Fit } from "@/types";

const FIT_TEXT: Record<Fit, { label: string; tone: "positive" | "caution" | "danger" | "neutral"; title: string }> = {
  fits: { label: "Fits", tone: "positive", title: "Fits in free memory right now" },
  tight: { label: "Tight", tone: "caution", title: "Needs more than is free now, but fits once memory is reclaimed" },
  too_big: { label: "Too big", tone: "danger", title: "Larger than this Mac's usable memory" },
  unknown: { label: "Unknown", tone: "neutral", title: "Size could not be estimated from the name" },
};
const FIT_BAR: Record<Fit, string> = {
  fits: "bg-positive",
  tight: "bg-caution",
  too_big: "bg-destructive",
  unknown: "bg-muted-foreground",
};

/** Memory this model needs, drawn against everything this Mac can give a model. */
const props = defineProps<{ model: CatalogModel; usableBytes: number }>();
const fit = computed(() => props.model.fit ?? "unknown");
const text = computed(() => FIT_TEXT[fit.value]);
const share = computed(() =>
  props.model.est_ram_bytes && props.usableBytes ? Math.min(props.model.est_ram_bytes / props.usableBytes, 1) : 0,
);
</script>

<template>
  <div class="flex w-[9.5rem] flex-col gap-1" :title="text.title">
    <div class="flex items-baseline justify-between text-sm">
      <span class="tabular">{{ bytes(model.est_ram_bytes) }}</span>
      <Tag :tone="text.tone">{{ text.label }}</Tag>
    </div>
    <div class="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div class="h-full rounded-full" :class="FIT_BAR[fit]" :style="{ width: `${Math.max(share * 100, 2)}%` }" />
    </div>
  </div>
</template>
