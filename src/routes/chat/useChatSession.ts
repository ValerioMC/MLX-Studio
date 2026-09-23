import { api } from "@/lib/api/client";
import { streamChat } from "@/lib/api/chat";
import { queryClient, queryKeys } from "@/lib/api/queries";
import { toModelHistory, toStoredMessages } from "@/lib/chat/history";
import { splitReasoning } from "@/lib/chat/reasoning";
import { messageId, useChat, type UIMsg } from "@/stores/chat";
import { usePreferences } from "@/stores/preferences";
import type { Conversation } from "@/types";

interface StoredMessage {
  role: UIMsg["role"];
  content: string;
  tok_per_sec?: number | null;
}

function refreshConversations(): void {
  void queryClient.invalidateQueries({ queryKey: queryKeys.conversations });
}

/** Saves the thread; history is best-effort and never interrupts the chat. */
async function persistThread(conversationId: string, thread: readonly UIMsg[]): Promise<void> {
  try {
    await api(`/conversations/${conversationId}/messages`, {
      method: "PUT",
      body: JSON.stringify({ messages: toStoredMessages(thread) }),
    });
    refreshConversations();
  } catch {
    // The live thread is unaffected; it will be saved with the next exchange.
  }
}

async function ensureConversation(modelId: string): Promise<string | null> {
  const existing = useChat.getState().conversationId;
  if (existing) return existing;
  try {
    const conversation = await api<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({ model_id: modelId }),
    });
    useChat.getState().setConversationId(conversation.id);
    return conversation.id;
  } catch {
    return null; // keep chatting unpersisted rather than blocking
  }
}

/**
 * Streams a reply to `thread` from `modelId`, appending it as the last message.
 * Tokens are applied once per animation frame: re-rendering the thread on every
 * token is wasted work at 60+ tokens a second.
 */
async function generate(modelId: string, thread: UIMsg[]): Promise<void> {
  const chat = useChat.getState();
  const { systemPrompt, temperature, maxTokens } = usePreferences.getState();
  chat.setMessages([...thread, { id: messageId(), role: "assistant", content: "", streaming: true }]);
  chat.setBusy(true);

  const conversationId = await ensureConversation(modelId);
  let pending = "";
  let frame = 0;
  let firstTokenAt: number | null = null;

  const flush = () => {
    frame = 0;
    if (!pending) return;
    const text = pending;
    pending = "";
    useChat.getState().updateLast((last) => {
      const content = last.content + text;
      if (last.thoughtMs === undefined && firstTokenAt !== null) {
        const { reasoning, thinking } = splitReasoning(content);
        if (reasoning !== null && !thinking) return { content, thoughtMs: Date.now() - firstTokenAt };
      }
      return { content };
    });
  };

  const abort = streamChat(
    modelId,
    toModelHistory(thread, systemPrompt),
    { temperature, maxTokens },
    (token) => {
      firstTokenAt ??= Date.now();
      pending += token;
      if (!frame) frame = requestAnimationFrame(flush);
    },
    (result) => {
      if (frame) cancelAnimationFrame(frame);
      flush();
      const state = useChat.getState();
      state.updateLast(() => ({
        streaming: false,
        error: result.error,
        finishReason: result.finishReason,
        tokPerSec: result.tokPerSec,
        timeToFirstToken: result.timeToFirstToken,
      }));
      state.setBusy(false);
      state.setAbort(null);
      if (conversationId && !result.error) void persistThread(conversationId, useChat.getState().messages);
    },
  );
  useChat.getState().setAbort(abort);
}

export function sendMessage(modelId: string, text: string, images: string[]): void {
  const chat = useChat.getState();
  if (chat.busy || !modelId || (!text.trim() && images.length === 0)) return;
  chat.setInput("");
  const message: UIMsg = { id: messageId(), role: "user", content: text.trim(), images: images.length ? images : undefined };
  void generate(modelId, [...chat.messages, message]);
}

/** Answers the last question again, replacing the last answer. */
export function regenerate(modelId: string): void {
  const chat = useChat.getState();
  if (chat.busy || !modelId) return;
  const lastUser = chat.messages.map((m) => m.role).lastIndexOf("user");
  if (lastUser === -1) return;
  void generate(modelId, chat.messages.slice(0, lastUser + 1));
}

export function stopGenerating(): void {
  useChat.getState().abort?.();
}

export async function openConversation(conversation: Conversation): Promise<void> {
  const chat = useChat.getState();
  if (chat.busy || conversation.id === chat.conversationId) return;
  const res = await api<{ items: StoredMessage[] }>(`/conversations/${conversation.id}/messages`);
  chat.setMessages(
    res.items.map((m) => ({
      id: messageId(),
      role: m.role,
      content: m.content,
      tokPerSec: m.tok_per_sec ?? undefined,
    })),
  );
  chat.setConversationId(conversation.id);
  if (conversation.model_id) chat.setModel(conversation.model_id);
}

export async function deleteConversation(id: string): Promise<void> {
  await api(`/conversations/${id}`, { method: "DELETE" });
  refreshConversations();
  if (id === useChat.getState().conversationId) useChat.getState().reset();
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await api(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
  refreshConversations();
}
