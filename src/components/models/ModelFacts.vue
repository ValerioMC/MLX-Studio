<script setup lang="ts">
import { Eye } from "lucide-vue-next";
import Badge from "@/components/ui/Badge.vue";
import { params } from "@/lib/format";
import type { Model } from "@/types";

/** Size, quantization and capabilities, as badges; nothing when none are known. */
withDefaults(defineProps<{ model: Model; showInstruct?: boolean }>(), { showInstruct: false });
</script>

<template>
  <span
    v-if="model.params_b != null || model.quantization || model.vision || (showInstruct && model.instruct)"
    class="flex flex-wrap items-center gap-1"
  >
    <Badge v-if="model.params_b != null" mono>{{ params(model.params_b) }}</Badge>
    <Badge v-if="model.quantization" mono>{{ model.quantization }}</Badge>
    <Badge v-if="model.vision" tone="accent">
      <Eye aria-hidden="true" />
      Vision
    </Badge>
    <Badge v-if="showInstruct && model.instruct">Instruct</Badge>
  </span>
</template>
