import { defineStore } from "pinia";
import { ref } from "vue";

export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Secondary line, e.g. what to do next. */
  detail?: string;
  action?: ToastAction;
}

/**
 * How long each kind stays. Errors get read, successes only glanced at; an
 * action (e.g. "Open chat") adds time so there is a chance to reach for it.
 */
export const TOAST_DURATION_MS: Record<ToastKind, number> = { success: 3200, info: 4200, error: 7000 };
export const ACTION_EXTRA_MS = 3000;
/** Oldest toasts drop off beyond this, so the stack never walls off the corner. */
const MAX_VISIBLE = 4;

let nextId = 0;

/** App-wide notifications, for outcomes that happen away from where you are looking. */
export const useToasts = defineStore("toasts", () => {
  const toasts = ref<Toast[]>([]);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  function dismiss(id: number): void {
    clearTimeout(timers.get(id));
    timers.delete(id);
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  function push(kind: ToastKind, message: string, options: { detail?: string; action?: ToastAction } = {}): number {
    nextId += 1;
    const id = nextId;
    toasts.value = [...toasts.value, { id, kind, message, ...options }].slice(-MAX_VISIBLE);
    const duration = TOAST_DURATION_MS[kind] + (options.action ? ACTION_EXTRA_MS : 0);
    timers.set(
      id,
      setTimeout(() => dismiss(id), duration),
    );
    return id;
  }

  function notify(message: string, options?: { detail?: string; action?: ToastAction }): number {
    return push("success", message, options);
  }

  function notifyError(error: unknown, fallback = "Something went wrong"): number {
    const message = error instanceof Error && error.message ? error.message : fallback;
    return push("error", message);
  }

  function inform(message: string, options?: { detail?: string; action?: ToastAction }): number {
    return push("info", message, options);
  }

  return { toasts, notify, notifyError, inform, dismiss };
});
