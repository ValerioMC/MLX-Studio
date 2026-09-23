<script setup lang="ts">
import { computed } from "vue";
import CodeBlock from "./CodeBlock.vue";
import { markdownSegments } from "./markdownRenderer";
import { openExternal } from "@/lib/openExternal";

const PROSE_CLASS = [
  "text-md leading-[1.65] [overflow-wrap:anywhere]",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-2.5 [&_ul]:my-2.5 [&_ol]:my-2.5 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_li]:pl-0.5",
  "[&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-lg [&_h1]:font-semibold",
  "[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-md [&_h3]:font-semibold",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
  "[&_hr]:my-5 [&_strong]:font-semibold",
  "[&_a]:text-accent [&_a]:underline [&_a]:decoration-accent/40 [&_a]:underline-offset-2 hover:[&_a]:decoration-accent",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-[1px] [&_code]:font-mono [&_code]:text-[0.88em]",
  "[&_table]:my-3 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm",
  "[&_th]:border-b [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border-b [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top",
].join(" ");

const props = defineProps<{ content: string }>();
const segments = computed(() => markdownSegments(props.content));

function onClick(event: MouseEvent): void {
  const link = (event.target as HTMLElement).closest("a[href]");
  const href = link?.getAttribute("href");
  if (href && /^https?:\/\//.test(href)) {
    event.preventDefault();
    void openExternal(href);
  }
}
</script>

<template>
  <!-- Model output and model cards, rendered as GitHub-flavored Markdown. -->
  <div :class="PROSE_CLASS" @click="onClick">
    <template v-for="(seg, i) in segments" :key="i">
      <CodeBlock v-if="seg.type === 'code'" :language="seg.lang" :code="seg.code" />
      <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false, so no raw HTML from model output ever reaches this. -->
      <div v-else v-html="seg.html" />
    </template>
    <slot name="trailing" />
  </div>
</template>
