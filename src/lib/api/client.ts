/**
 * Typed client for the FastAPI sidecar. At runtime the Tauri core injects the
 * port + per-launch token via `get_runtime_config`; in browser dev we fall back
 * to localhost defaults.
 */

export interface RuntimeConfig {
  port: number;
  token: string;
  apiKey: string;
}

let config: RuntimeConfig = {
  port: 11535,
  token: "dev-token",
  apiKey: "mlx-studio-local",
};

export async function initRuntimeConfig(): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    config = await invoke<RuntimeConfig>("get_runtime_config");
  } catch {
    // Browser dev: keep the localhost defaults.
  }
}

export function baseUrl(): string {
  return `http://127.0.0.1:${config.port}`;
}

/** A non-2xx answer from the sidecar, with the message it gave. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The human-readable message in a FastAPI error body. `detail` is a string for
 * plain HTTPExceptions, `{type, message}` for the sidecar's typed errors, and a
 * list for request validation errors.
 */
export function errorMessage(body: unknown, fallback: string): string {
  if (typeof body !== "object" || body === null) return fallback;
  const record = body as Record<string, unknown>;
  const detail = record.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown } | undefined;
    if (typeof first?.msg === "string") return first.msg;
  }
  if (typeof detail === "object" && detail !== null) {
    const message = (detail as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  const error = record.error;
  if (typeof error === "object" && error !== null) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}

function headers(openai = false): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${openai ? config.apiKey : config.token}`,
  };
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    throw new ApiError(res.status, errorMessage(body, res.statusText || `Request failed (${res.status})`));
  }
  return res.json() as Promise<T>;
}

export const apiKeyHeaders = () => headers(true);
export const getConfig = () => config;
