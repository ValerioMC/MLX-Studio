import { api } from "@/lib/api/client";
import { streamChat } from "@/lib/api/chat";
import { queryClient, queryKeys } from "@/lib/api/queries";
import { toModelHistory, toStoredMessages } from "@/lib/chat/history";
import { splitReasoning } from "@/lib/chat/reasoning";
import { messageId, useChat, type UIMsg } from "@/stores/chat";
import { usePreferences } from "@/stores/preferences";
import type { Conversation } from "@/types";

interface LoadedMessage {
  role: UIMsg["role"];
  content: string;
  images?: string[] | null;
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
  const chat = useChat();
  if (chat.conversationId) return chat.conversationId;
  try {
    const conversation = await api<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({ model_id: modelId }),
    });
    chat.conversationId = conversation.id;
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
  const chat = useChat();
  const preferences = usePreferences();
  chat.setMessages([...thread, { id: messageId(), role: "assistant", content: "", streaming: true }]);
  chat.busy = true;

  const conversationId = await ensureConversation(modelId);
  let pending = "";
  let frame = 0;
  let firstTokenAt: number | null = null;

  const flush = () => {
    frame = 0;
    if (!pending) return;
    const text = pending;
    pending = "";
    chat.updateLast((last) => {
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
    toModelHistory(thread, preferences.systemPrompt),
    { temperature: preferences.temperature, maxTokens: preferences.maxTokens },
    (token) => {
      firstTokenAt ??= Date.now();
      pending += token;
      if (!frame) frame = requestAnimationFrame(flush);
    },
    (result) => {
      if (frame) cancelAnimationFrame(frame);
      flush();
      chat.updateLast(() => ({
        streaming: false,
        error: result.error,
        finishReason: result.finishReason,
        tokPerSec: result.tokPerSec,
        timeToFirstToken: result.timeToFirstToken,
      }));
      chat.busy = false;
      chat.abort = null;
      if (conversationId && !result.error) void persistThread(conversationId, chat.messages);
    },
  );
  chat.abort = abort;
}

export function sendMessage(modelId: string, text: string, images: string[]): void {
  const chat = useChat();
  if (chat.busy || !modelId || (!text.trim() && images.length === 0)) return;
  chat.input = "";
  const message: UIMsg = {
    id: messageId(),
    role: "user",
    content: text.trim(),
    images: images.length ? images : undefined,
  };
  void generate(modelId, [...chat.messages, message]);
}

/** Answers the last question again, replacing the last answer. */
export function regenerate(modelId: string): void {
  const chat = useChat();
  if (chat.busy || !modelId) return;
  const lastUser = chat.messages.map((m) => m.role).lastIndexOf("user");
  if (lastUser === -1) return;
  void generate(modelId, chat.messages.slice(0, lastUser + 1));
}

export function stopGenerating(): void {
  useChat().abort?.();
}

export async function openConversation(conversation: Conversation): Promise<void> {
  const chat = useChat();
  if (chat.busy || conversation.id === chat.conversationId) return;
  const res = await api<{ items: LoadedMessage[] }>(`/conversations/${conversation.id}/messages`);
  chat.setMessages(
    res.items.map((m) => ({
      id: messageId(),
      role: m.role,
      content: m.content,
      images: m.images?.length ? m.images : undefined,
      tokPerSec: m.tok_per_sec ?? undefined,
    })),
  );
  chat.conversationId = conversation.id;
  if (conversation.model_id) chat.model = conversation.model_id;
}

export async function deleteConversation(id: string): Promise<void> {
  await api(`/conversations/${id}`, { method: "DELETE" });
  refreshConversations();
  const chat = useChat();
  if (id === chat.conversationId) chat.reset();
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await api(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
  refreshConversations();
}
