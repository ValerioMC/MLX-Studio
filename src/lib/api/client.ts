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
    // Browser dev — keep defaults.
  }
}

export function baseUrl(): string {
  return `http://127.0.0.1:${config.port}`;
}

function headers(openai = false): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${openai ? config.apiKey : config.token}`,
  };
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || body?.detail?.message || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const apiKeyHeaders = () => headers(true);
export const getConfig = () => config;
