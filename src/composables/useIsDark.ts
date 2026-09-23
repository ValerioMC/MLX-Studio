import { onMounted, onUnmounted, ref, type Ref } from "vue";

/** Whether the dark theme is on, whichever way it was chosen. */
export function useIsDark(): Ref<boolean> {
  const isDark = ref(!document.documentElement.classList.contains("light"));
  let observer: MutationObserver | undefined;

  onMounted(() => {
    observer = new MutationObserver(() => {
      isDark.value = !document.documentElement.classList.contains("light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  });
  onUnmounted(() => observer?.disconnect());

  return isDark;
}
