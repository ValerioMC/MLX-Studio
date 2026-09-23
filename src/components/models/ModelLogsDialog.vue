<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { api } from "@/lib/api/client";
import Dialog from "@/components/ui/Dialog.vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import InlineError from "@/components/ui/InlineError.vue";
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
    panel-class="w-[52rem]"
    @close="$emit('close')"
  >
    <InlineError v-if="isError">{{ error?.message }}</InlineError>
    <p v-if="lines && lines.length === 0" class="py-6 text-center text-sm text-muted-foreground">
      Nothing logged yet. Start the model to see its activity.
    </p>
    <pre
      v-if="lines && lines.length > 0"
      ref="scrollRef"
      class="selectable h-[26rem] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]"
      @scroll="onScroll"
    >{{ text }}</pre>

    <template v-if="text" #footer>
      <CopyButton :text="text" label="Copy all" show-label class="mr-auto" />
    </template>
  </Dialog>
</template>
