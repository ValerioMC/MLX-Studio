import { create } from "zustand";
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

interface ChatState {
  messages: UIMsg[];
  input: string;
  model: string;
  busy: boolean;
  /** Persisted conversation backing the current thread; null until first exchange. */
  conversationId: string | null;
  /** Aborts the in-flight stream; kept here so it survives navigation. */
  abort: (() => void) | null;
  setInput: (value: string) => void;
  setModel: (value: string) => void;
  setBusy: (value: boolean) => void;
  setConversationId: (id: string | null) => void;
  setAbort: (fn: (() => void) | null) => void;
  setMessages: (updater: UIMsg[] | ((prev: UIMsg[]) => UIMsg[])) => void;
  /** Rewrites the last message (the one streaming). */
  updateLast: (patch: (last: UIMsg) => Partial<UIMsg>) => void;
  reset: () => void;
}

// State lives in the store (not the component) so leaving and re-entering the
// Chat tab keeps the conversation and any in-flight generation.
export const useChat = create<ChatState>((set) => ({
  messages: [],
  input: "",
  model: "",
  busy: false,
  conversationId: null,
  abort: null,
  setInput: (input) => set({ input }),
  setModel: (model) => set({ model }),
  setBusy: (busy) => set({ busy }),
  setConversationId: (conversationId) => set({ conversationId }),
  setAbort: (abort) => set({ abort }),
  setMessages: (updater) =>
    set((state) => ({
      messages: typeof updater === "function" ? updater(state.messages) : updater,
    })),
  updateLast: (patch) =>
    set((state) => {
      const last = state.messages[state.messages.length - 1];
      if (!last) return state;
      return { messages: [...state.messages.slice(0, -1), { ...last, ...patch(last) }] };
    }),
  reset: () => set({ messages: [], input: "", conversationId: null }),
}));
