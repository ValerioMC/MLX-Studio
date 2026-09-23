<script setup lang="ts">
import { Eye } from "lucide-vue-next";
import Tag from "@/components/ui/Tag.vue";
import { params } from "@/lib/format";
import type { Model } from "@/types";

/** Size, quantization and capabilities, as tags; nothing when none are known. */
withDefaults(defineProps<{ model: Model; showInstruct?: boolean }>(), { showInstruct: false });
</script>

<template>
  <span
    v-if="model.params_b != null || model.quantization || model.vision || (showInstruct && model.instruct)"
    class="flex flex-wrap items-center gap-1"
  >
    <Tag v-if="model.params_b != null">{{ params(model.params_b) }}</Tag>
    <Tag v-if="model.quantization">{{ model.quantization }}</Tag>
    <Tag v-if="model.vision" tone="accent">
      <Eye aria-hidden="true" />
      Vision
    </Tag>
    <Tag v-if="showInstruct && model.instruct">Instruct</Tag>
  </span>
</template>
