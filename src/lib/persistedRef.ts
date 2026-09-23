import { ref, watch, type Ref } from "vue";

/**
 * A ref backed by `localStorage` under `key`, JSON-encoded. Reads once at
 * creation — synchronously, so the value is correct before first paint — and
 * writes on every change.
 */
export function persistedRef<T>(key: string, initial: T): Ref<T> {
  let value = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    // Corrupt or unavailable storage: fall back to the default.
  }
  const state = ref(value) as Ref<T>;
  watch(
    state,
    (next) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage unavailable (private browsing, quota): the choice just isn't remembered.
      }
    },
    { deep: true },
  );
  return state;
}
