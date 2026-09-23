import { apiKeyHeaders, baseUrl, errorMessage } from "./client";
import { drainFrames } from "@/lib/sse";

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  /** Plain text, or OpenAI-style content parts when images are attached. */
  content: string | ContentPart[];
}

export type FinishReason = "stop" | "length" | "tool_calls" | "error";

export interface StreamResult {
  tokPerSec?: number;
  timeToFirstToken?: number;
  finishReason?: FinishReason;
  error?: string;
}

export interface GenerationOptions {
  temperature: number;
  maxTokens: number;
}

/** What one streamed chunk carries. */
export interface ChunkEvent {
  delta: string;
  finishReason?: FinishReason;
  tokPerSec?: number;
  timeToFirstToken?: number;
}

interface WireChunk {
  choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { tok_per_sec?: number; time_to_first_token?: number | null };
}

const FINISH_REASONS: readonly FinishReason[] = ["stop", "length", "tool_calls", "error"];

export function readChunk(payload: string): ChunkEvent | null {
  let chunk: WireChunk;
  try {
    chunk = JSON.parse(payload) as WireChunk;
  } catch {
    return null;
  }
  const choice = chunk.choices?.[0];
  const reason = choice?.finish_reason;
  return {
    delta: choice?.delta?.content ?? "",
    finishReason: FINISH_REASONS.find((r) => r === reason),
    tokPerSec: chunk.usage?.tok_per_sec,
    timeToFirstToken: chunk.usage?.time_to_first_token ?? undefined,
  };
}

/** The sidecar reports generation failures in-band, as a final "[error] …" delta. */
const ERROR_PREFIX = /^\s*\[error\]\s*/;

/**
 * Stream tokens from the OpenAI-compatible endpoint. Returns an abort function;
 * calling it cancels the fetch, which the server detects to stop generation.
 */
export function streamChat(
  model: string,
  messages: ChatMsg[],
  options: GenerationOptions,
  onToken: (token: string) => void,
  onDone: (result: StreamResult) => void,
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
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      throw new Error(errorMessage(body, res.statusText || `Request failed (${res.status})`));
    }
    if (!res.body) throw new Error("The engine sent an empty response.");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const result: StreamResult = {};
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { payloads, rest } = drainFrames(buffer);
      buffer = rest;
      for (const payload of payloads) {
        if (payload === "[DONE]") continue;
        const event = readChunk(payload);
        if (!event) continue;
        if (event.finishReason === "error") {
          result.error = event.delta.replace(ERROR_PREFIX, "").trim() || "Generation failed.";
          result.finishReason = "error";
          continue;
        }
        if (event.delta) onToken(event.delta);
        if (event.finishReason) result.finishReason = event.finishReason;
        if (event.tokPerSec !== undefined) result.tokPerSec = event.tokPerSec;
        if (event.timeToFirstToken !== undefined) result.timeToFirstToken = event.timeToFirstToken;
      }
    }
    onDone(result);
  })().catch((e: unknown) =>
    // A user-initiated stop is not an error.
    onDone(ctrl.signal.aborted ? { finishReason: "stop" } : { error: e instanceof Error ? e.message : "Request failed" }),
  );
  return () => ctrl.abort();
}
