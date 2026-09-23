<script setup lang="ts">
import { computed } from "vue";
import CodeBlock from "./CodeBlock.vue";
import { markdownSegments } from "./markdownRenderer";
import { openExternal } from "@/lib/openExternal";

const PROSE_CLASS = [
  "text-md leading-[1.7] text-fg/95 [overflow-wrap:anywhere]",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>div>*:first-child]:mt-0 [&>div:last-child>*:last-child]:mb-0",
  "[&_p]:my-3 [&_ul]:my-3 [&_ol]:my-3 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_li]:pl-1",
  "[&_li::marker]:text-subtle",
  "[&_h1]:mb-2 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold",
  "[&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold",
  "[&_h3]:mb-1.5 [&_h3]:mt-5 [&_h3]:text-md [&_h3]:font-semibold",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-accent-line [&_blockquote]:pl-4 [&_blockquote]:text-muted",
  "[&_hr]:my-6 [&_hr]:border-line [&_strong]:font-semibold [&_strong]:text-fg",
  "[&_a]:text-accent-text [&_a]:underline [&_a]:decoration-accent/40 [&_a]:underline-offset-[3px] hover:[&_a]:decoration-accent",
  "[&_:not(pre)>code]:rounded-control [&_:not(pre)>code]:bg-fg/[0.07] [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-[1px] [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.86em] [&_:not(pre)>code]:text-fg",
  "[&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm",
  "[&_th]:border-b [&_th]:border-line-strong [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border-b [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
].join(" ");

const props = withDefaults(defineProps<{ content: string; streaming?: boolean }>(), { streaming: false });
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
  <div :class="[PROSE_CLASS, streaming && 'is-streaming']" @click="onClick">
    <template v-for="(seg, i) in segments" :key="i">
      <CodeBlock v-if="seg.type === 'code'" :language="seg.lang" :code="seg.code" />
      <!-- eslint-disable-next-line vue/no-v-html -- markdown-it runs with html:false, so no raw HTML from model output ever reaches this. -->
      <div v-else v-html="seg.html" />
    </template>
  </div>
</template>

<style>
/* Unscoped on purpose: the paragraphs come from v-html, which scoped styles
   cannot reach.
   The streaming caret sits *after the last word*, inline, in the signal
   color — not on a line of its own under the reply. It exists only while the
   reply is still arriving. */
.is-streaming > div:last-child > :last-child::after {
  content: "";
  display: inline-block;
  width: 7px;
  height: 1.05em;
  margin-left: 3px;
  vertical-align: -0.17em;
  border-radius: 9999px;
  background: rgb(var(--accent));
  box-shadow: 0 0 8px rgb(var(--accent) / 0.7);
  animation: caret 1s steps(1) infinite;
}
</style>
