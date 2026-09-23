<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/vue-query";
import { Play } from "lucide-vue-next";
import { api } from "@/lib/api/client";
import { fetchEstimate, queryClient, queryKeys } from "@/lib/api/queries";
import { bytes, contextSize } from "@/lib/format";
import { useMemoryLedger } from "@/composables/useMemoryLedger";
import Dialog from "@/components/ui/Dialog.vue";
import Slider from "@/components/ui/Slider.vue";
import Switch from "@/components/ui/Switch.vue";
import Button from "@/components/ui/Button.vue";
import InlineError from "@/components/ui/InlineError.vue";
import LedgerBar from "@/components/system/LedgerBar.vue";
import type { Fit, Model } from "@/types";

const MIN_CONTEXT = 1024;
const CONTEXT_STEP = 1024;
const FALLBACK_MAX_CONTEXT = 32768;
const DEFAULT_CONTEXT = 8192;
const ESTIMATE_DEBOUNCE_MS = 180;

const FIT_MESSAGE: Record<Fit, { text: string; className: string }> = {
  fits: { text: "Fits in free memory.", className: "text-positive" },
  tight: {
    text: "More than is free right now. macOS will reclaim cached memory to make room, which can slow other apps.",
    className: "text-caution",
  },
  too_big: { text: "Too big for this Mac at this context length. Lower it to start.", className: "text-destructive" },
  unknown: { text: "Could not estimate this model's memory. It may still start.", className: "text-muted-foreground" },
};

/** Pick a context length and see the memory it costs before loading. */
const props = defineProps<{ model: Model }>();
const emit = defineEmits<{ close: []; started: [model: Model] }>();

const context = ref(Math.min(props.model.context_length || DEFAULT_CONTEXT, DEFAULT_CONTEXT));
const thinking = ref(true);

const debouncedContext = ref(context.value);
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
watch(context, (value) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedContext.value = value;
  }, ESTIMATE_DEBOUNCE_MS);
});

const { data: estimate } = useQuery({
  queryKey: computed(() => queryKeys.estimate(props.model.id, debouncedContext.value)),
  queryFn: () => fetchEstimate(props.model.id, debouncedContext.value),
  placeholderData: keepPreviousData,
});

const maxContext = computed(() =>
  Math.max(estimate.value?.max_context || props.model.context_length || FALLBACK_MAX_CONTEXT, MIN_CONTEXT),
);
const contextClamped = computed(() => Math.min(context.value, maxContext.value));
const needed = computed(() => estimate.value?.est_ram_bytes ?? null);
const ledger = useMemoryLedger(() =>
  needed.value != null ? { label: props.model.display_name, bytes: needed.value } : undefined,
);
const fit = computed(() => FIT_MESSAGE[estimate.value?.fit ?? "unknown"]);

const {
  mutate: doStart,
  isPending: starting,
  isError: startFailed,
  error: startError,
} = useMutation({
  mutationFn: () =>
    api(`/models/${encodeURIComponent(props.model.id)}/start`, {
      method: "POST",
      body: JSON.stringify({ context_length: context.value, enable_thinking: thinking.value }),
    }),
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.models });
    void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
    emit("started", { ...props.model, status: "running" });
  },
});
</script>

<template>
  <Dialog
    :title="`Start ${model.display_name}`"
    description="A longer context lets the model read more at once, and costs memory."
    :dismissible="!starting"
    panel-class="w-[32rem]"
    @close="emit('close')"
  >
    <div class="flex flex-col gap-5">
      <section class="flex flex-col gap-2">
        <div class="flex items-baseline justify-between">
          <label for="context-length" class="text-base font-medium">Context length</label>
          <span class="tabular text-base">
            {{ context.toLocaleString() }} <span class="text-muted-foreground">tokens</span>
          </span>
        </div>
        <Slider
          label="Context length"
          :min="MIN_CONTEXT"
          :max="maxContext"
          :step="CONTEXT_STEP"
          :model-value="contextClamped"
          @update:model-value="context = $event"
        />
        <div class="flex justify-between text-2xs tabular text-muted-foreground">
          <span>{{ contextSize(MIN_CONTEXT) }}</span>
          <span>{{ contextSize(maxContext) }} max</span>
        </div>
      </section>

      <section class="flex flex-col gap-2.5">
        <div class="flex items-baseline justify-between">
          <h3 class="text-base font-medium">Memory</h3>
          <span class="tabular text-base font-medium">{{ needed != null ? bytes(needed) : "—" }}</span>
        </div>
        <LedgerBar v-if="ledger" :ledger="ledger" height="h-5" :overflow="estimate?.fit === 'too_big'" />
        <dl v-if="estimate?.est_ram_bytes != null" class="grid grid-cols-[1fr_auto] gap-x-6 gap-y-0.5 text-sm text-muted-foreground">
          <dt>Weights</dt>
          <dd class="tabular text-right text-foreground">{{ bytes(estimate.weight_bytes) }}</dd>
          <dt>KV cache at {{ contextSize(context) }} context</dt>
          <dd class="tabular text-right text-foreground">{{ bytes(estimate.kv_cache_bytes) }}</dd>
          <dt>Runtime overhead</dt>
          <dd class="tabular text-right text-foreground">{{ bytes(estimate.overhead_bytes) }}</dd>
          <dt>Free for models now</dt>
          <dd class="tabular text-right text-foreground">{{ bytes(estimate.budget_bytes) }}</dd>
        </dl>
        <p :class="['text-sm', fit.className]">{{ fit.text }}</p>
      </section>

      <section class="flex items-start justify-between gap-6 border-t pt-4">
        <div>
          <p class="text-base font-medium">Reasoning</p>
          <p class="text-sm text-muted-foreground">
            Lets models that think first (Qwen3, DeepSeek-R1) do so. Off gives direct answers.
          </p>
        </div>
        <Switch v-model="thinking" label="Reasoning" />
      </section>

      <InlineError v-if="startFailed">{{ startError?.message }}</InlineError>
    </div>

    <template #footer>
      <span v-if="starting" class="mr-auto text-sm text-muted-foreground">Loading weights into memory…</span>
      <Button variant="secondary" :disabled="starting" @click="emit('close')">Cancel</Button>
      <Button :loading="starting" :disabled="estimate?.fit === 'too_big'" @click="doStart()">
        <Play v-if="!starting" />
        {{ starting ? "Starting" : "Start" }}
      </Button>
    </template>
  </Dialog>
</template>
