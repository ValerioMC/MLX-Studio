<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { api } from "@/lib/api/client";
import Dialog from "@/components/ui/Dialog.vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import Callout from "@/components/ui/Callout.vue";
import StatusDot from "@/components/ui/StatusDot.vue";
import type { Model } from "@/types";

const TAIL_LINES = 200;
const REFRESH_MS = 2000;
/** Within this distance of the end, new lines keep the view pinned to the bottom. */
const STICK_THRESHOLD_PX = 32;

/** The model's diagnostic log: loads, timings, throughput and failures, never chat text. */
const props = defineProps<{ model: Model }>();
defineEmits<{ close: [] }>();

const {
  data: lines,
  isError,
  error,
} = useQuery({
  queryKey: ["model-logs", props.model.id],
  queryFn: () =>
    api<{ lines: string[] }>(`/models/${encodeURIComponent(props.model.id)}/logs?tail=${TAIL_LINES}`).then(
      (r) => r.lines,
    ),
  refetchInterval: REFRESH_MS,
});

const scrollRef = ref<HTMLPreElement | null>(null);
const stuck = ref(true);
const text = computed(() => (lines.value ?? []).join("\n"));

watch(lines, async () => {
  await nextTick();
  const el = scrollRef.value;
  if (el && stuck.value) el.scrollTop = el.scrollHeight;
});

function onScroll(): void {
  const el = scrollRef.value;
  if (!el) return;
  stuck.value = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
}
</script>

<template>
  <Dialog
    :title="`${model.display_name} log`"
    :description="`The last ${TAIL_LINES} lines, refreshed every ${REFRESH_MS / 1000} s. Chat text is never logged.`"
    panel-class="w-[54rem]"
    @close="$emit('close')"
  >
    <Callout v-if="isError">{{ error?.message }}</Callout>
    <p v-if="lines && lines.length === 0" class="py-10 text-center text-sm text-muted">
      Nothing logged yet. Start the model to see its activity.
    </p>
    <!-- A terminal pane set into the dialog: recessed, monospace, with a live
         light while the tail is following new lines. -->
    <div v-if="lines && lines.length > 0" class="overflow-hidden rounded-card border border-line bg-canvas/80 shadow-[inset_0_1px_3px_rgb(0_0_0/0.4)]">
      <div class="flex h-8 items-center gap-2 border-b border-line px-3.5 text-xs text-subtle">
        <StatusDot :tone="stuck ? 'accent' : 'idle'" />
        {{ stuck ? "Following" : "Scrolled back" }}
        <span class="tabular ml-auto">{{ lines.length }} lines</span>
      </div>
      <pre
        ref="scrollRef"
        class="selectable h-[26rem] overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12px] leading-[1.7] text-muted [overflow-wrap:anywhere]"
        @scroll="onScroll"
      >{{ text }}</pre>
    </div>

    <template v-if="text" #footer>
      <CopyButton :text="text" label="Copy all" show-label class="mr-auto" />
    </template>
  </Dialog>
</template>
