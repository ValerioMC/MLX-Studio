import { create } from "zustand";

export interface UIMsg {
  role: "system" | "user" | "assistant";
  content: string;
  /** Data URLs of images attached to a user message, for bubble rendering. */
  images?: string[];
  streaming?: boolean;
  error?: boolean;
  tokPerSec?: number;
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
      messages:
        typeof updater === "function" ? updater(state.messages) : updater,
    })),
  reset: () => set({ messages: [], input: "", conversationId: null }),
}));
