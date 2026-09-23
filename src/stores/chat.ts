import { defineStore } from "pinia";
import { ref } from "vue";
import type { FinishReason } from "@/lib/api/chat";

export interface UIMsg {
  /** Stable key for rendering; not persisted. */
  id: string;
  role: "system" | "user" | "assistant";
  content: string;
  /** Data URLs of images attached to a user message, for bubble rendering. */
  images?: string[];
  streaming?: boolean;
  /** The failure message, when generation failed. */
  error?: string;
  finishReason?: FinishReason;
  tokPerSec?: number;
  timeToFirstToken?: number;
  /** How long the model spent thinking, measured while it streamed. */
  thoughtMs?: number;
}

let nextId = 0;
export function messageId(): string {
  nextId += 1;
  return `m${Date.now().toString(36)}${nextId}`;
}

// State lives in the store (not the component) so leaving and re-entering the
// Chat tab keeps the conversation and any in-flight generation.
export const useChat = defineStore("chat", () => {
  const messages = ref<UIMsg[]>([]);
  const input = ref("");
  const model = ref("");
  const busy = ref(false);
  /** Persisted conversation backing the current thread; null until first exchange. */
  const conversationId = ref<string | null>(null);
  /** Aborts the in-flight stream; kept here so it survives navigation. */
  const abort = ref<(() => void) | null>(null);

  function setMessages(updater: UIMsg[] | ((prev: UIMsg[]) => UIMsg[])): void {
    messages.value = typeof updater === "function" ? updater(messages.value) : updater;
  }

  /** Rewrites the last message (the one streaming). */
  function updateLast(patch: (last: UIMsg) => Partial<UIMsg>): void {
    const last = messages.value[messages.value.length - 1];
    if (!last) return;
    messages.value = [...messages.value.slice(0, -1), { ...last, ...patch(last) }];
  }

  function reset(): void {
    messages.value = [];
    input.value = "";
    conversationId.value = null;
  }

  return { messages, input, model, busy, conversationId, abort, setMessages, updateLast, reset };
});
