<script setup lang="ts">
import { computed, ref } from "vue";
import { Brain, ChevronRight, RotateCcw } from "lucide-vue-next";
import Markdown from "@/components/chat/Markdown.vue";
import ModelCore from "@/components/instruments/ModelCore.vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import Button from "@/components/ui/Button.vue";
import Callout from "@/components/ui/Callout.vue";
import { splitReasoning } from "@/lib/chat/reasoning";
import { cn } from "@/lib/utils";
import type { UIMsg } from "@/stores/chat";

const props = withDefaults(
  defineProps<{
    message: UIMsg;
    isLast: boolean;
    onRegenerate?: () => void;
    maxTokens: number;
    /** Memory tone of the model answering, so its core here matches the rail and the dial. */
    tone?: number;
  }>(),
  { tone: 0 },
);

const reasoningOpen = ref(false);
const split = computed(() => splitReasoning(props.message.content));
const waiting = computed(() => props.message.streaming && props.message.content === "");
const thinkingNow = computed(() => split.value.thinking && !!props.message.streaming);

function thoughtLabel(): string {
  if (thinkingNow.value) return "Thinking";
  if (props.message.thoughtMs === undefined) return "Reasoning";
  const seconds = Math.max(1, Math.round(props.message.thoughtMs / 1000));
  return `Thought for ${seconds} s`;
}
</script>

<template>
  <div v-if="message.role === 'user'" class="flex flex-col items-end gap-2 pl-16">
    <div v-if="message.images && message.images.length > 0" class="flex flex-wrap justify-end gap-2">
      <img
        v-for="(src, i) in message.images"
        :key="i"
        :src="src"
        :alt="`Attached image ${i + 1}`"
        class="max-h-48 max-w-[16rem] rounded-card object-cover ring-1 ring-line-strong"
      />
    </div>
    <div
      v-if="message.content"
      class="selectable whitespace-pre-wrap rounded-card border border-line-strong/60 bg-raised px-4 py-2.5 text-md leading-relaxed shadow-lift [overflow-wrap:anywhere]"
    >
      {{ message.content }}
    </div>
  </div>

  <!-- A reply: the answering model's core sits in the gutter, lit while it
       streams — the same object as in the rail, so "which model, and is it
       still going" is answered without a label. -->
  <article v-else class="group/message grid grid-cols-[28px_minmax(0,1fr)] gap-3.5" :aria-busy="message.streaming || undefined">
    <div class="pt-0.5">
      <ModelCore :state="message.streaming ? 'generating' : message.error ? 'error' : 'running'" :tone="tone" :size="22" />
    </div>
    <div class="min-w-0">
      <p v-if="waiting" class="shimmer-text pt-0.5 text-sm font-medium">Reading your message…</p>

      <div v-if="split.reasoning !== null" class="mb-3">
        <button
          type="button"
          :aria-expanded="reasoningOpen"
          class="inline-flex h-control-sm items-center gap-1.5 rounded-full pl-2 pr-3 text-sm font-medium text-muted ring-1 ring-inset ring-line transition-colors hover:text-fg hover:ring-line-strong"
          @click="reasoningOpen = !reasoningOpen"
        >
          <Brain :class="cn('h-3.5 w-3.5', thinkingNow && 'text-accent-text')" />
          <span :class="thinkingNow && 'shimmer-text'">{{ thoughtLabel() }}</span>
          <ChevronRight :class="cn('h-3.5 w-3.5 transition-transform duration-200', reasoningOpen && 'rotate-90')" />
        </button>
        <Transition name="expand">
          <div v-if="reasoningOpen" class="grid grid-rows-[1fr]">
            <div class="overflow-hidden">
              <div
                class="selectable mt-2 whitespace-pre-wrap rounded-control border-l-2 border-accent-line bg-fg/[0.025] py-2.5 pl-4 pr-3 text-sm leading-relaxed text-muted"
              >
                {{ split.reasoning }}
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <Markdown v-if="split.answer" :content="split.answer" :streaming="!!message.streaming" />

      <Callout v-if="message.error" class="mt-2">
        {{ message.error }}
        <template v-if="isLast && onRegenerate" #action>
          <Button variant="secondary" size="sm" @click="onRegenerate?.()">
            <RotateCcw />
            Try again
          </Button>
        </template>
      </Callout>
      <Callout v-if="message.finishReason === 'length' && !message.streaming" tone="warn" class="mt-3">
        Stopped at the {{ maxTokens.toLocaleString() }}-token limit. Raise “Longest reply” in chat settings for longer
        answers.
      </Callout>

      <div
        v-if="!message.streaming && !message.error"
        :class="
          cn(
            'mt-2 flex h-control-sm items-center gap-0.5 transition-opacity duration-150',
            !isLast && 'opacity-0 focus-within:opacity-100 group-hover/message:opacity-100',
          )
        "
      >
        <CopyButton :text="split.answer" label="Copy answer" />
        <button
          v-if="isLast && onRegenerate"
          type="button"
          aria-label="Regenerate answer"
          title="Regenerate"
          class="grid h-control-sm w-control-sm place-items-center rounded-control text-muted transition-colors hover:bg-fg/[0.06] hover:text-fg"
          @click="onRegenerate?.()"
        >
          <RotateCcw class="h-3.5 w-3.5" />
        </button>
        <span
          v-if="message.tokPerSec != null && message.tokPerSec > 0"
          class="tabular ml-2 font-mono text-2xs text-subtle"
          title="Generation speed on this Mac"
        >
          {{ message.tokPerSec.toFixed(1) }} tok/s{{
            message.timeToFirstToken != null ? ` · ${message.timeToFirstToken.toFixed(1)} s to first token` : ""
          }}
        </span>
      </div>
    </div>
  </article>
</template>
