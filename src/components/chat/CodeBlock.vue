<script setup lang="ts">
import { computed } from "vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import { highlight } from "./highlighter";

const props = defineProps<{ language: string; code: string }>();
const html = computed(() => highlight(props.code, props.language));
</script>

<template>
  <div class="group/code my-3 overflow-hidden rounded-lg border bg-muted/40">
    <div class="flex h-8 items-center justify-between border-b pl-3 pr-1.5 text-xs text-muted-foreground">
      <span>{{ language }}</span>
      <CopyButton :text="code" label="Copy code" show-label />
    </div>
    <!-- eslint-disable-next-line vue/no-v-html -- Prism.highlight output over an escaped code string, not model-controlled markup. -->
    <pre class="overflow-x-auto px-[0.9rem] py-[0.8rem] text-[0.86rem] leading-relaxed"><code class="font-mono" v-html="html" /></pre>
  </div>
</template>
