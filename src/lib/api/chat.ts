import { apiKeyHeaders, baseUrl } from "./client";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Stream tokens from the OpenAI-compatible endpoint. Returns an abort function;
 * calling it cancels the fetch, which the server detects to stop generation.
 */
export function streamChat(
  model: string,
  messages: ChatMsg[],
  opts: { temperature?: number; maxTokens?: number } = {},
  onToken: (t: string) => void,
  onDone: (meta: { tokPerSec?: number }) => void,
): () => void {
  const ctrl = new AbortController();
  (async () => {
    const res = await fetch(`${baseUrl()}/v1/chat/completions`, {
      method: "POST",
      headers: apiKeyHeaders(),
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1024,
      }),
    });
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let meta = {};
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) onToken(delta);
          if (json.usage?.tok_per_sec) meta = { tokPerSec: json.usage.tok_per_sec };
        } catch {
          /* ignore */
        }
      }
    }
    onDone(meta);
  })().catch(() => onDone({}));
  return () => ctrl.abort();
}
