<script setup lang="ts">
import { computed } from "vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import { highlight } from "./highlighter";

const props = defineProps<{ language: string; code: string }>();
const html = computed(() => highlight(props.code, props.language));
</script>

<template>
  <!-- A code block is a recessed well with a label strip: the language on
       the left, copy on the right, and the code set below the surface. -->
  <div class="group/code my-4 overflow-hidden rounded-card border border-line bg-canvas/70 shadow-[inset_0_1px_3px_rgb(0_0_0/0.35)]">
    <div class="flex h-9 items-center justify-between border-b border-line bg-fg/[0.025] pl-3.5 pr-1.5">
      <span class="flex items-center gap-2 font-mono text-xs text-subtle">
        <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-accent/70" />
        {{ language || "text" }}
      </span>
      <CopyButton :text="code" label="Copy code" show-label />
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -- Prism.highlight output over an escaped code string, not model-controlled markup. -->
    <pre class="overflow-x-auto px-4 py-3.5 text-[12.5px] leading-[1.7]"><code class="font-mono" v-html="html" /></pre>
  </div>
</template>
