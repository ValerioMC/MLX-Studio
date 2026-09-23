import type { ChatMsg } from "@/lib/api/chat";
import type { UIMsg } from "@/stores/chat";
import { stripReasoning } from "./reasoning";

/**
 * The thread as the model should see it: the system prompt first, failed or
 * empty replies dropped, and past reasoning removed from assistant turns
 * (reasoning models are trained to see only prior answers, and it saves
 * context). Images stay attached so a vision model keeps seeing them.
 */
export function toModelHistory(thread: readonly UIMsg[], systemPrompt: string): ChatMsg[] {
  const history: ChatMsg[] = [];
  const system = systemPrompt.trim();
  if (system) history.push({ role: "system", content: system });

  for (const message of thread) {
    if (message.role === "assistant") {
      if (message.error) continue;
      const answer = stripReasoning(message.content).trim();
      if (answer) history.push({ role: "assistant", content: answer });
      continue;
    }
    if (message.images?.length) {
      history.push({
        role: message.role,
        content: [
          ...message.images.map((url) => ({ type: "image_url" as const, image_url: { url } })),
          ...(message.content ? [{ type: "text" as const, text: message.content }] : []),
        ],
      });
      continue;
    }
    history.push({ role: message.role, content: message.content });
  }
  return history;
}

export interface StoredMessage {
  role: UIMsg["role"];
  content: string;
  images: string[] | null;
  tok_per_sec: number | null;
}

/** The thread in the shape the conversation store saves: finished turns, with their images. */
export function toStoredMessages(thread: readonly UIMsg[]): StoredMessage[] {
  return thread
    .filter((m) => !m.streaming && !m.error && (m.role !== "assistant" || m.content.trim() !== ""))
    .map((m) => ({
      role: m.role,
      content: m.content,
      images: m.images?.length ? m.images : null,
      tok_per_sec: m.tokPerSec ?? null,
    }));
}
