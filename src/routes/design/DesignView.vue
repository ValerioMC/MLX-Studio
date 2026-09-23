<script setup lang="ts">
/**
 * The design system on one page: every primitive in every variant, every
 * instrument in every state, next to its neighbours — so an inconsistency is
 * visible here before it is buried in a real screen. Not in the nav; reached
 * at #/design (or from the command palette).
 */
import { ref } from "vue";
import { Download, Play, Trash2 } from "lucide-vue-next";
import { memoryLedger } from "@/lib/memory";
import { useToasts } from "@/stores/toast";
import FitGauge from "@/components/instruments/FitGauge.vue";
import MemoryCells from "@/components/instruments/MemoryCells.vue";
import MemoryDial from "@/components/instruments/MemoryDial.vue";
import ModelCore, { type CoreState } from "@/components/instruments/ModelCore.vue";
import ProgressRing from "@/components/instruments/ProgressRing.vue";
import Sparkline from "@/components/instruments/Sparkline.vue";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Callout from "@/components/ui/Callout.vue";
import Card from "@/components/ui/Card.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import Kbd from "@/components/ui/Kbd.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import Segmented from "@/components/ui/Segmented.vue";
import Select from "@/components/ui/Select.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import Slider from "@/components/ui/Slider.vue";
import Switch from "@/components/ui/Switch.vue";
import { fieldClass } from "@/components/ui/field";
import type { DownloadStatus } from "@/types";

const GB = 1024 ** 3;
const CORE_STATES: CoreState[] = ["idle", "loading", "running", "generating", "stopping", "error"];
const RING_STATES: { status: DownloadStatus; percent: number }[] = [
  { status: "queued", percent: 0 },
  { status: "downloading", percent: 62 },
  { status: "paused", percent: 31 },
  { status: "failed", percent: 18 },
  { status: "completed", percent: 100 },
];

const ledger = memoryLedger(
  {
    ram_total: 36 * GB,
    ram_used: 21 * GB,
    ram_available: 17 * GB,
    swap_used: 0,
    cpu_percent: 20,
    disk_free: 400 * GB,
    reserve_bytes: 5.4 * GB,
    loaded_models: [
      { model_id: "a", context_length: 8192, est_ram_bytes: 6 * GB, tone: 0 },
      { model_id: "b", context_length: 8192, est_ram_bytes: 5 * GB, tone: 1 },
      { model_id: "c", context_length: 8192, est_ram_bytes: 3 * GB, tone: 2 },
    ],
  },
  (id) => ({ a: "Qwen3 8B", b: "Gemma 3 12B", c: "Phi 4 mini" })[id] ?? id,
);
const pendingLedger = memoryLedger(
  { ram_total: 36 * GB, ram_used: 21 * GB, ram_available: 17 * GB, swap_used: 0, cpu_percent: 0, disk_free: 0, reserve_bytes: 5.4 * GB, loaded_models: [] },
  (id) => id,
  { label: "Llama 70B", bytes: 20 * GB },
);
const trace = Array.from({ length: 60 }, (_, i) => 30 + 20 * Math.sin(i / 5) + (i % 7) * 3);

const toasts = useToasts();
const hovered = ref<string | null>(null);
const cycling = ref<CoreState>("idle");
const theme = ref<"a" | "b" | "c">("a");
const sort = ref<"one" | "two" | "three">("one");
const on = ref(true);
const slider = ref(40);
const confirmOpen = ref(false);

function cycle(): void {
  const next = CORE_STATES[(CORE_STATES.indexOf(cycling.value) + 1) % CORE_STATES.length];
  cycling.value = next ?? "idle";
}
</script>

<template>
  <div class="flex flex-col gap-10">
    <PageHeader title="Design system" eyebrow="Every primitive and instrument, in every state" />

    <section class="flex flex-col gap-4">
      <h2 class="text-lg font-semibold">ModelCore</h2>
      <Card class="flex flex-wrap items-end gap-10 p-6">
        <div v-for="s in CORE_STATES" :key="s" class="flex flex-col items-center gap-3">
          <ModelCore :state="s" :size="48" :tone="1" />
          <ModelCore :state="s" :size="16" />
          <span class="text-xs text-muted">{{ s }}</span>
        </div>
        <div class="ml-auto flex flex-col items-center gap-3">
          <ModelCore :state="cycling" :size="48" />
          <Button variant="secondary" size="sm" @click="cycle">Next state: arrivals</Button>
        </div>
      </Card>
    </section>

    <section class="flex flex-col gap-4">
      <h2 class="text-lg font-semibold">Memory</h2>
      <Card class="grid grid-cols-[auto_1fr] items-center gap-8 p-6">
        <MemoryDial v-model:hovered="hovered" :ledger="ledger" busy-key="model:a" :size="240" />
        <div class="flex flex-col gap-5">
          <MemoryCells :ledger="ledger" />
          <MemoryCells :ledger="pendingLedger" />
          <MemoryCells :ledger="ledger" height="sm" :max-cells="40" />
          <div class="flex gap-6">
            <FitGauge fit="fits" :need-bytes="5 * GB" :usable-bytes="30 * GB" :free-bytes="12 * GB" />
            <FitGauge fit="tight" :need-bytes="17 * GB" :usable-bytes="30 * GB" :free-bytes="12 * GB" />
            <FitGauge fit="too_big" :need-bytes="40 * GB" :usable-bytes="30 * GB" :free-bytes="12 * GB" />
          </div>
          <div class="flex items-center gap-6">
            <ProgressRing v-for="r in RING_STATES" :key="r.status" :status="r.status" :percent="r.percent" :size="40" />
            <Sparkline :values="trace" :width="140" :height="36" />
          </div>
        </div>
      </Card>
    </section>

    <section class="flex flex-col gap-4">
      <h2 class="text-lg font-semibold">Buttons</h2>
      <Card class="flex flex-col gap-4 p-6">
        <div class="flex flex-wrap items-center gap-2">
          <Button><Play class="fill-current" />Primary</Button>
          <Button variant="secondary"><Download />Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="danger-quiet"><Trash2 />Danger quiet</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="sm" variant="secondary">Small</Button>
          <Button size="icon" variant="secondary" aria-label="Download"><Download /></Button>
          <Button size="icon-sm" variant="ghost" aria-label="Delete"><Trash2 /></Button>
          <CopyButton text="copied from the design page" label="Copy" show-label />
          <Kbd>⌘K</Kbd>
        </div>
      </Card>
    </section>

    <section class="flex flex-col gap-4">
      <h2 class="text-lg font-semibold">Controls</h2>
      <Card class="grid grid-cols-2 gap-6 p-6">
        <input :class="[fieldClass, 'h-control']" placeholder="A field" />
        <input :class="[fieldClass, 'h-control']" aria-invalid="true" value="An invalid field" />
        <Segmented v-model="theme" label="Demo" :options="[{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }, { value: 'c', label: 'Three' }]" />
        <Select v-model="sort" label="Demo select" :options="[{ value: 'one', label: 'First option' }, { value: 'two', label: 'Second option', hint: '8K' }, { value: 'three', label: 'Third option' }]" />
        <div class="flex items-center gap-3"><Switch v-model="on" label="Demo switch" /> <span class="text-sm text-muted">Switch</span></div>
        <Slider v-model="slider" label="Demo slider" :min="0" :max="100" :step="1" :ticks="5" />
      </Card>
    </section>

    <section class="flex flex-col gap-4">
      <h2 class="text-lg font-semibold">Feedback</h2>
      <div class="flex flex-wrap gap-1.5">
        <Badge>Neutral</Badge>
        <Badge tone="accent" dot>Accent</Badge>
        <Badge tone="safe" dot>Safe</Badge>
        <Badge tone="warn" dot>Warn</Badge>
        <Badge tone="danger" dot>Danger</Badge>
        <Badge mono>4bit</Badge>
      </div>
      <Callout>Something failed, and this says what.</Callout>
      <Callout tone="warn">Something is slow, and this says why.</Callout>
      <Callout tone="info">Something worth knowing.</Callout>
      <div class="flex gap-2">
        <Button variant="secondary" @click="toasts.notify('Qwen3 8B is running', { detail: 'Loaded into memory.', action: { label: 'Open chat', run: () => undefined } })">Success toast</Button>
        <Button variant="secondary" @click="toasts.notifyError(new Error('Could not reach Hugging Face'))">Error toast</Button>
        <Button variant="danger-quiet" @click="confirmOpen = true">Confirm dialog</Button>
      </div>
      <Card class="flex flex-col gap-2 p-4">
        <Skeleton variant="row" />
        <Skeleton class="w-2/3" />
      </Card>
      <EmptyState title="Nothing here yet">Calm blank space, not an error.</EmptyState>
    </section>

    <ConfirmDialog v-if="confirmOpen" title="Delete Qwen3 8B?" confirm-label="Delete model" @cancel="confirmOpen = false" @confirm="confirmOpen = false">
      You can download it again from the catalog.
      <template #blast>Removes <b>4.6 GB</b> of weights from this Mac.</template>
    </ConfirmDialog>
  </div>
</template>
