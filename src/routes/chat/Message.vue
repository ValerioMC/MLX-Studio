<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronRight, RotateCcw } from "lucide-vue-next";
import Markdown from "@/components/chat/Markdown.vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import Button from "@/components/ui/Button.vue";
import { splitReasoning } from "@/lib/chat/reasoning";
import { cn } from "@/lib/utils";
import type { UIMsg } from "@/stores/chat";

const props = defineProps<{
  message: UIMsg;
  isLast: boolean;
  onRegenerate?: () => void;
  maxTokens: number;
}>();

const reasoningOpen = ref(false);
const split = computed(() => splitReasoning(props.message.content));
const waiting = computed(() => props.message.streaming && props.message.content === "");

function thoughtLabel(): string {
  if (split.value.thinking && props.message.streaming) return "Thinking";
  if (props.message.thoughtMs === undefined) return "Reasoning";
  const seconds = Math.max(1, Math.round(props.message.thoughtMs / 1000));
  return `Thought for ${seconds} s`;
}
</script>

<template>
  <div v-if="message.role === 'user'" class="flex flex-col items-end gap-2">
    <div v-if="message.images && message.images.length > 0" class="flex flex-wrap justify-end gap-2">
      <img
        v-for="(src, i) in message.images"
        :key="i"
        :src="src"
        :alt="`Attached image ${i + 1}`"
        class="max-h-48 max-w-[16rem] rounded-lg border object-cover"
      />
    </div>
    <div
      v-if="message.content"
      class="selectable max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-md leading-relaxed [overflow-wrap:anywhere]"
    >
      {{ message.content }}
    </div>
  </div>

  <article v-else class="group/message" :aria-busy="message.streaming || undefined">
    <p v-if="waiting" class="animate-pulse text-sm text-muted-foreground">Reading your message…</p>

    <div v-if="split.reasoning !== null" class="mb-3">
      <button
        type="button"
        :aria-expanded="reasoningOpen"
        :class="
          cn(
            'inline-flex items-center gap-1 rounded-md py-0.5 pr-1.5 text-sm font-medium text-muted-foreground hover:text-foreground',
            split.thinking && message.streaming && 'animate-pulse',
          )
        "
        @click="reasoningOpen = !reasoningOpen"
      >
        <ChevronRight :class="cn('h-3.5 w-3.5 transition-transform', reasoningOpen && 'rotate-90')" />
        {{ thoughtLabel() }}
      </button>
      <div
        v-if="reasoningOpen"
        class="selectable ml-[7px] mt-1.5 whitespace-pre-wrap border-l-2 pl-4 text-sm leading-relaxed text-muted-foreground"
      >
        {{ split.reasoning }}
      </div>
    </div>

    <Markdown v-if="split.answer" :content="split.answer" />

    <div
      v-if="message.error"
      role="alert"
      class="mt-2 flex items-center gap-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <span class="flex-1">{{ message.error }}</span>
      <Button v-if="isLast && onRegenerate" variant="secondary" size="sm" @click="onRegenerate?.()">
        <RotateCcw />
        Try again
      </Button>
    </div>
    <p v-if="message.finishReason === 'length' && !message.streaming" class="mt-2 text-sm text-caution">
      Stopped at the {{ maxTokens.toLocaleString() }}-token limit. Raise “Longest reply” in chat settings for longer
      answers.
    </p>

    <div
      v-if="!message.streaming && !message.error"
      :class="
        cn(
          'mt-1.5 flex h-6 items-center gap-1 transition-opacity',
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
        class="inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        @click="onRegenerate?.()"
      >
        <RotateCcw class="h-3.5 w-3.5" />
      </button>
      <span class="ml-1.5">
        <span
          v-if="message.tokPerSec != null && message.tokPerSec > 0"
          class="tabular text-xs text-muted-foreground"
          title="Generation speed on this Mac"
        >
          {{ message.tokPerSec.toFixed(1) }} tok/s{{
            message.timeToFirstToken != null ? `, first token in ${message.timeToFirstToken.toFixed(1)} s` : ""
          }}
        </span>
      </span>
    </div>
  </article>
</template>
