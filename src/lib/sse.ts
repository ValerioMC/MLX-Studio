import { baseUrl, getConfig } from "./api/client";

/** Subscribe to a server SSE endpoint (internal token auth). */
export function subscribeSSE<T>(
  path: string,
  onEvent: (data: T) => void,
): () => void {
  const ctrl = new AbortController();
  (async () => {
    const res = await fetch(`${baseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${getConfig().token}` },
      signal: ctrl.signal,
    });
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line; servers may use LF or CRLF.
      const frames = buf.split(/\r?\n\r?\n/);
      buf = frames.pop() || "";
      for (const frame of frames) {
        const line = frame.split(/\r?\n/).find((l) => l.startsWith("data:"));
        if (line) {
          try {
            onEvent(JSON.parse(line.slice(5).trim()));
          } catch {
            /* ignore */
          }
        }
      }
    }
  })().catch(() => {});
  return () => ctrl.abort();
}
