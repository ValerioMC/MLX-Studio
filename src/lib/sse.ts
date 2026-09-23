import { baseUrl, getConfig } from "./api/client";

const RETRY_INITIAL_MS = 500;
const RETRY_MAX_MS = 5000;

/**
 * Splits buffered SSE text into complete frames' `data:` payloads, returning
 * them with the incomplete tail to keep buffering. Frames are separated by a
 * blank line; servers may use LF or CRLF.
 */
export function drainFrames(buffer: string): { payloads: string[]; rest: string } {
  const frames = buffer.split(/\r?\n\r?\n/);
  const rest = frames.pop() ?? "";
  const payloads = frames.flatMap((frame) => {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());
    return data.length ? [data.join("\n")] : [];
  });
  return { payloads, rest };
}

/**
 * Subscribe to a server SSE endpoint (internal token auth). Reconnects with
 * backoff when the stream fails or ends, so a subscription opened while the
 * sidecar is still booting starts delivering once it is up.
 */
export function subscribeSSE<T>(path: string, onEvent: (data: T) => void): () => void {
  const ctrl = new AbortController();
  let retryMs = RETRY_INITIAL_MS;

  const connect = async (): Promise<void> => {
    const res = await fetch(`${baseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${getConfig().token}` },
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new Error(`SSE ${path} failed: ${res.status}`);
    retryMs = RETRY_INITIAL_MS;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const { payloads, rest } = drainFrames(buffer);
      buffer = rest;
      for (const payload of payloads) {
        let data: T;
        try {
          data = JSON.parse(payload) as T;
        } catch {
          continue; // keep-alive comments and non-JSON frames carry nothing for us
        }
        onEvent(data);
      }
    }
  };

  (async () => {
    while (!ctrl.signal.aborted) {
      try {
        await connect();
      } catch {
        // Engine down or restarting: retried below until unsubscribed.
      }
      if (ctrl.signal.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, retryMs));
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    }
  })();

  return () => ctrl.abort();
}
