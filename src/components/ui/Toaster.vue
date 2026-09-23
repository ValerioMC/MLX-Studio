<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, X } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { useToasts, type ToastKind } from "@/stores/toast";

/** The toast stack, bottom-right, above everything. Mounted once, by the shell. */
const toasts = useToasts();

const ICON: Record<ToastKind, { glyph: typeof CircleCheck; tint: string }> = {
  success: { glyph: CircleCheck, tint: "text-safe" },
  error: { glyph: CircleAlert, tint: "text-danger" },
  info: { glyph: Info, tint: "text-muted" },
};
</script>

<template>
  <Teleport to="body">
    <div
      aria-live="polite"
      aria-relevant="additions"
      class="no-drag pointer-events-none fixed bottom-5 right-5 z-toast flex w-[22rem] flex-col items-end gap-2"
    >
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts.toasts"
          :key="t.id"
          :role="t.kind === 'error' ? 'alert' : 'status'"
          :class="
            cn(
              'edge-lit pointer-events-auto flex w-full items-start gap-3 rounded-card border bg-surface/95 px-4 py-3 shadow-modal backdrop-blur-xl',
              t.kind === 'error' ? 'border-danger-line' : 'border-line',
            )
          "
        >
          <component :is="ICON[t.kind].glyph" :class="cn('mt-px h-4 w-4 shrink-0', ICON[t.kind].tint)" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="text-base font-medium">{{ t.message }}</p>
            <p v-if="t.detail" class="pt-0.5 text-sm text-muted">{{ t.detail }}</p>
            <button
              v-if="t.action"
              type="button"
              class="mt-1.5 text-sm font-semibold text-accent-text hover:underline"
              @click="
                () => {
                  t.action?.run();
                  toasts.dismiss(t.id);
                }
              "
            >
              {{ t.action.label }}
            </button>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            class="-mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-control text-subtle hover:bg-fg/[0.06] hover:text-fg"
            @click="toasts.dismiss(t.id)"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
