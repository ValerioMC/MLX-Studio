import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ACTION_EXTRA_MS, TOAST_DURATION_MS, useToasts } from "./toast";

describe("useToasts", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("dismisses a success after its own duration", () => {
    const toasts = useToasts();
    toasts.notify("Saved");

    vi.advanceTimersByTime(TOAST_DURATION_MS.success - 1);
    expect(toasts.toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts.toasts).toHaveLength(0);
  });

  it("keeps an error longer than a success", () => {
    const toasts = useToasts();
    toasts.notifyError(new Error("Download failed"));

    vi.advanceTimersByTime(TOAST_DURATION_MS.success);
    expect(toasts.toasts[0]).toMatchObject({ kind: "error", message: "Download failed" });
  });

  it("falls back to a generic message for a non-Error", () => {
    const toasts = useToasts();
    toasts.notifyError("boom", "Could not start");

    expect(toasts.toasts[0]?.message).toBe("Could not start");
  });

  it("gives a toast with an action extra time to reach for it", () => {
    const toasts = useToasts();
    toasts.notify("Model started", { action: { label: "Open chat", run: () => undefined } });

    vi.advanceTimersByTime(TOAST_DURATION_MS.success + ACTION_EXTRA_MS - 1);
    expect(toasts.toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts.toasts).toHaveLength(0);
  });

  it("keeps at most four on screen, dropping the oldest", () => {
    const toasts = useToasts();
    for (const n of [1, 2, 3, 4, 5]) toasts.inform(`t${n}`);

    expect(toasts.toasts.map((t) => t.message)).toEqual(["t2", "t3", "t4", "t5"]);
  });

  it("removes a toast dismissed by hand", () => {
    const toasts = useToasts();
    const id = toasts.notify("Copied");
    toasts.dismiss(id);

    expect(toasts.toasts).toHaveLength(0);
  });
});
