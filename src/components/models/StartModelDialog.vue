<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/vue-query";
import { Play } from "lucide-vue-next";
import { api } from "@/lib/api/client";
import { fetchEstimate, queryClient, queryKeys } from "@/lib/api/queries";
import { bytes, contextSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMemoryLedger } from "@/composables/useMemoryLedger";
import Dialog from "@/components/ui/Dialog.vue";
import Slider from "@/components/ui/Slider.vue";
import Switch from "@/components/ui/Switch.vue";
import Button from "@/components/ui/Button.vue";
import Callout from "@/components/ui/Callout.vue";
import Badge, { type Tone } from "@/components/ui/Badge.vue";
import MemoryCells from "@/components/instruments/MemoryCells.vue";
import ModelCore from "@/components/instruments/ModelCore.vue";
import ModelFacts from "./ModelFacts.vue";
import { modelMutationKey } from "./useModelActions";
import type { Fit, Model } from "@/types";

const MIN_CONTEXT = 1024;
const CONTEXT_STEP = 1024;
const FALLBACK_MAX_CONTEXT = 32768;
const DEFAULT_CONTEXT = 8192;
const ESTIMATE_DEBOUNCE_MS = 180;
/** Quick picks under the slider: the context sizes people actually quote. */
const PRESETS = [4096, 8192, 16384, 32768, 65536, 131072] as const;

const FIT: Record<Fit, { label: string; tone: Tone; text: string }> = {
  fits: { label: "Fits", tone: "safe", text: "Fits in free memory." },
  tight: {
    label: "Tight",
    tone: "warn",
    text: "More than is free right now. macOS will reclaim cached memory to make room, which can slow other apps.",
  },
  too_big: { label: "Too big", tone: "danger", text: "Too big for this Mac at this context length. Lower it to start." },
  unknown: { label: "Unknown", tone: "neutral", text: "Could not estimate this model's memory. It may still start." },
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
const presets = computed(() => PRESETS.filter((p) => p <= maxContext.value));
const needed = computed(() => estimate.value?.est_ram_bytes ?? null);
const ledger = useMemoryLedger(() =>
  needed.value != null ? { label: props.model.display_name, bytes: needed.value } : undefined,
);
const fit = computed(() => FIT[estimate.value?.fit ?? "unknown"]);

const {
  mutate: doStart,
  isPending: starting,
  isError: startFailed,
  error: startError,
} = useMutation({
  mutationKey: modelMutationKey("start"),
  mutationFn: (_modelId: string) =>
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
  <Dialog :title="`Start ${model.display_name}`" :dismissible="!starting" panel-class="w-[34rem]" @close="emit('close')">
    <template #description>
      <span class="flex items-center gap-2 pt-1">
        <ModelFacts :model="model" />
        <span class="font-mono text-xs text-subtle">{{ model.hf_repo_id }}</span>
      </span>
    </template>

    <div class="flex flex-col gap-6">
      <section class="flex flex-col gap-3">
        <div class="flex items-baseline justify-between">
          <label for="context-length" class="text-base font-medium">Context length</label>
          <span class="tabular text-lg font-semibold">
            {{ context.toLocaleString() }} <span class="text-sm font-normal text-muted">tokens</span>
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
        <div class="flex flex-wrap gap-1">
          <button
            v-for="p in presets"
            :key="p"
            type="button"
            :class="
              cn(
                'tabular h-6 rounded-control px-2 font-mono text-xs font-medium ring-1 ring-inset transition-colors',
                context === p ? 'bg-accent-soft text-accent-text ring-accent-line' : 'text-muted ring-line hover:text-fg hover:ring-line-strong',
              )
            "
            @click="context = p"
          >
            {{ contextSize(p) }}
          </button>
          <span class="tabular ml-auto self-center text-xs text-subtle">max {{ contextSize(maxContext) }}</span>
        </div>
        <p class="text-sm text-muted">A longer context lets the model read more at once, and costs memory.</p>
      </section>

      <section class="flex flex-col gap-3 rounded-card border border-line bg-canvas/40 p-4">
        <div class="flex items-center justify-between">
          <h3 class="flex items-center gap-2 text-base font-medium">
            Memory
            <Badge :tone="fit.tone" dot>{{ fit.label }}</Badge>
          </h3>
          <span class="tabular text-lg font-semibold">{{ needed != null ? bytes(needed) : "—" }}</span>
        </div>
        <MemoryCells v-if="ledger" :ledger="ledger" :max-cells="48" />
        <dl
          v-if="estimate?.est_ram_bytes != null"
          class="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-line pt-3 text-sm text-muted"
        >
          <dt>Weights</dt>
          <dd class="tabular text-right text-fg">{{ bytes(estimate.weight_bytes) }}</dd>
          <dt>KV cache at {{ contextSize(context) }} context</dt>
          <dd class="tabular text-right text-fg">{{ bytes(estimate.kv_cache_bytes) }}</dd>
          <dt>Runtime overhead</dt>
          <dd class="tabular text-right text-fg">{{ bytes(estimate.overhead_bytes) }}</dd>
          <dt>Free for models now</dt>
          <dd class="tabular text-right text-fg">{{ bytes(estimate.budget_bytes) }}</dd>
        </dl>
        <p :class="cn('text-sm', fit.tone === 'danger' ? 'text-danger' : fit.tone === 'warn' ? 'text-warn' : 'text-muted')">
          {{ fit.text }}
        </p>
      </section>

      <section class="flex items-start justify-between gap-6">
        <div>
          <p class="text-base font-medium">Reasoning</p>
          <p class="text-sm text-muted">Lets models that think first (Qwen3, DeepSeek-R1) do so. Off gives direct answers.</p>
        </div>
        <Switch v-model="thinking" label="Reasoning" />
      </section>

      <Callout v-if="startFailed">{{ startError?.message }}</Callout>
    </div>

    <template #footer>
      <span v-if="starting" class="mr-auto flex items-center gap-2.5 text-sm text-muted">
        <ModelCore state="loading" :size="18" />
        Loading weights into memory…
      </span>
      <Button variant="secondary" :disabled="starting" @click="emit('close')">Cancel</Button>
      <Button :loading="starting" :disabled="estimate?.fit === 'too_big'" data-autofocus @click="doStart(model.id)">
        <Play v-if="!starting" class="fill-current" />
        {{ starting ? "Starting" : "Start" }}
      </Button>
    </template>
  </Dialog>
</template>
