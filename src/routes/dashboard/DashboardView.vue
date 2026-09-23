<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Code2, MessageSquare, MessageSquarePlus, Play, Square } from "lucide-vue-next";
import { useActivity, useModels } from "@/lib/api/queries";
import { useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import { useUI } from "@/stores/ui";
import { useMemoryLedger } from "@/composables/useMemoryLedger";
import { useCoreState } from "@/composables/useCoreState";
import MemoryDial from "@/components/instruments/MemoryDial.vue";
import MemoryLegend from "@/components/instruments/MemoryLegend.vue";
import ModelCore from "@/components/instruments/ModelCore.vue";
import Sparkline from "@/components/instruments/Sparkline.vue";
import ConnectDialog from "@/components/models/ConnectDialog.vue";
import ModelFacts from "@/components/models/ModelFacts.vue";
import { useModelAction } from "@/components/models/useModelActions";
import Button from "@/components/ui/Button.vue";
import Callout from "@/components/ui/Callout.vue";
import Card from "@/components/ui/Card.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import StatusDot from "@/components/ui/StatusDot.vue";
import { bytes, contextSize, gigabytes } from "@/lib/format";
import { parseServerDate, relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Activity, Model } from "@/types";

/** Swap above this means macOS is short on memory and generation will crawl. */
const SWAP_WARNING_BYTES = 1024 ** 3;
const QUICK_START_LIMIT = 4;

const router = useRouter();
const live = useLive();
const ui = useUI();
const ledger = useMemoryLedger();
const { data: models, isLoading: modelsLoading } = useModels();
const { data: activity } = useActivity();
const chat = useChat();
const { stateOf, toneOf } = useCoreState();
const { mutate: stopModel, isPending: stopping, variables: stopVariables } = useModelAction("stop");
const connectTarget = ref<Model | null>(null);
/** Segment under the pointer, shared by the dial and its legend. */
const hovered = ref<string | null>(null);

const running = computed(() => models.value?.filter((m) => m.status === "running") ?? []);
const idle = computed(() => models.value?.filter((m) => m.status !== "running" && m.chat_capable !== false) ?? []);
const loaded = computed(() => new Map(live.stats?.loaded_models.map((m) => [m.model_id, m]) ?? []));
const busyKey = computed(() => (chat.busy && chat.model ? `model:${chat.model}` : null));
const swapping = computed(() => (live.stats?.swap_used ?? 0) > SWAP_WARNING_BYTES);

function openChat(model: Model): void {
  chat.model = model.id;
  void router.push("/chat");
}
function newChat(): void {
  if (!chat.busy) chat.reset();
  void router.push("/chat");
}
function share(model: Model): number {
  const est = loaded.value.get(model.id)?.est_ram_bytes ?? 0;
  return ledger.value ? est / (ledger.value.totalBytes || 1) : 0;
}

/** The dot on the activity timeline: what kind of event, by the one color that means it. */
function activityTone(a: Activity): string {
  if (/fail|error/i.test(a.message)) return "bg-danger";
  if (a.kind === "start") return "bg-accent shadow-[0_0_8px_rgb(var(--accent)/0.8)]";
  if (a.kind === "download") return "bg-safe";
  return "bg-subtle";
}
</script>

<template>
  <div>
    <PageHeader title="Overview">
      <template #eyebrow>
        <StatusDot :tone="ledger ? 'accent' : 'idle'" />
        <span v-if="ledger" class="tabular">Apple Silicon · {{ gigabytes(ledger.totalBytes) }} GB unified memory</span>
        <span v-else>Connecting to the local engine…</span>
      </template>
      <Button variant="secondary" @click="router.push('/catalog')">Browse catalog</Button>
      <Button title="New chat (⌘N)" @click="newChat">
        <MessageSquarePlus />
        New chat
      </Button>
    </PageHeader>

    <!-- The instrument. -->
    <Card as="section" aria-label="Unified memory" :lit="running.length > 0" class="relative overflow-hidden">
      <!-- A pool of the signal's light under the dial: the one lit object on the page. -->
      <div
        aria-hidden="true"
        class="pointer-events-none absolute -left-24 -top-24 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgb(var(--accent)/0.09),transparent_62%)]"
      />
      <div v-if="ledger && live.stats" class="relative grid grid-cols-1 items-center gap-8 p-7 lg:grid-cols-[auto_minmax(0,1fr)]">
        <MemoryDial v-model:hovered="hovered" :ledger="ledger" :busy-key="busyKey" :size="272" class="mx-auto" />
        <div class="flex min-w-0 flex-col gap-5">
          <div>
            <h2 class="px-2.5 pb-2 text-sm font-medium text-muted">Where the memory is</h2>
            <MemoryLegend v-model:hovered="hovered" :ledger="ledger" />
          </div>
          <dl class="grid grid-cols-3 gap-2.5">
            <!-- The CPU trace runs as a band along the tile's floor, so the
                 figure never has to share a line with it. -->
            <div class="relative flex flex-col gap-1 overflow-hidden rounded-control border border-line bg-canvas/40 p-3 pb-7">
              <dt class="text-xs text-muted">CPU</dt>
              <dd class="tabular whitespace-nowrap text-xl font-semibold">
                {{ Math.round(live.stats.cpu_percent) }}<span class="text-sm font-normal text-muted">%</span>
              </dd>
              <div class="absolute inset-x-0 bottom-0 h-7 opacity-90" aria-hidden="true">
                <Sparkline :values="live.cpuHistory" :width="120" :height="28" fluid />
              </div>
            </div>
            <div class="flex flex-col gap-1 rounded-control border border-line bg-canvas/40 p-3">
              <dt class="text-xs text-muted">Disk free</dt>
              <dd class="tabular whitespace-nowrap text-xl font-semibold">{{ bytes(live.stats.disk_free) }}</dd>
            </div>
            <div
              :class="
                cn(
                  'flex flex-col gap-1 rounded-control border p-3',
                  swapping ? 'border-warn-line bg-warn-soft' : 'border-line bg-canvas/40',
                )
              "
            >
              <dt class="text-xs text-muted">Swap</dt>
              <dd :class="cn('tabular whitespace-nowrap text-xl font-semibold', swapping && 'text-warn')">{{ bytes(live.stats.swap_used) }}</dd>
            </div>
          </dl>
          <Callout v-if="swapping" tone="warn">
            macOS is swapping {{ bytes(live.stats.swap_used) }} to disk, so generation will be slow. Stop a model or start
            it with a shorter context.
          </Callout>
        </div>
      </div>
      <div v-else class="grid grid-cols-[272px_1fr] items-center gap-8 p-7" aria-busy="true">
        <Skeleton variant="block" class="!h-[272px] !rounded-full" />
        <div class="flex flex-col gap-2">
          <Skeleton v-for="i in 5" :key="i" variant="row" />
        </div>
      </div>
    </Card>

    <div class="grid grid-cols-1 gap-x-8 gap-y-10 pt-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section aria-labelledby="running-heading">
        <h2 id="running-heading" class="flex items-baseline gap-2 pb-3 text-lg font-semibold">
          {{ running.length ? "Running" : "Start a model" }}
          <span v-if="running.length" class="tabular text-sm font-normal text-subtle">{{ running.length }}</span>
        </h2>

        <TransitionGroup v-if="running.length > 0" tag="div" name="list" class="relative flex flex-col gap-3">
          <Card v-for="m in running" :key="m.id" class="p-4">
            <div class="flex items-center gap-4">
              <ModelCore :state="stateOf(m)" :tone="toneOf(m)" :size="40" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-md font-semibold">{{ m.display_name }}</p>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted">
                  <ModelFacts :model="m" />
                  <span v-if="loaded.get(m.id)" class="tabular">{{ contextSize(loaded.get(m.id)!.context_length) }} context</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5">
                <Button size="sm" @click="openChat(m)">
                  <MessageSquare />
                  Chat
                </Button>
                <Button variant="secondary" size="sm" @click="connectTarget = m">
                  <Code2 />
                  Use from code
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  :aria-label="`Stop ${m.display_name}`"
                  :loading="stopping && stopVariables === m.id"
                  @click="stopModel(m.id)"
                >
                  <Square v-if="!(stopping && stopVariables === m.id)" class="!h-3 !w-3 fill-current" />
                  Stop
                </Button>
              </div>
            </div>
            <!-- Its share of the Mac, in its own tone: the same slice as on the dial. -->
            <div v-if="loaded.get(m.id)?.est_ram_bytes != null" class="flex items-center gap-3 pl-14 pt-3.5">
              <div class="h-1 flex-1 overflow-hidden rounded-full bg-fg/[0.06]">
                <div
                  class="h-full rounded-full transition-[width] duration-700 ease-out"
                  :style="{ width: `${Math.max(share(m) * 100, 1)}%`, background: `rgb(var(--seg-${toneOf(m) % 4}))` }"
                />
              </div>
              <span class="tabular text-xs text-muted">
                {{ bytes(loaded.get(m.id)!.est_ram_bytes) }} · {{ Math.round(share(m) * 100) }}% of memory
              </span>
            </div>
          </Card>
        </TransitionGroup>

        <div v-if="running.length === 0 && idle.length > 0" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card
            v-for="m in idle.slice(0, QUICK_START_LIMIT)"
            :key="m.id"
            interactive
            as="button"
            type="button"
            class="group flex items-center gap-3.5 p-4 text-left"
            @click="ui.requestStart(m, 'open-chat')"
          >
            <ModelCore :state="stateOf(m)" :size="32" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-base font-semibold">{{ m.display_name }}</p>
              <ModelFacts :model="m" class="pt-1" />
            </div>
            <span
              class="grid h-control-sm w-control-sm place-items-center rounded-full bg-fg/[0.06] text-muted transition-colors group-hover:bg-accent group-hover:text-accent-ink"
            >
              <Play class="h-3.5 w-3.5 fill-current" />
            </span>
          </Card>
        </div>
        <RouterLink
          v-if="running.length === 0 && idle.length > QUICK_START_LIMIT"
          to="/models"
          class="mt-3 inline-block text-sm font-medium text-accent-text hover:underline"
        >
          All {{ idle.length }} installed models →
        </RouterLink>

        <EmptyState v-if="!modelsLoading && models?.length === 0" title="No models yet">
          Download an MLX model from Hugging Face. Anything marked “Fits” runs well on this Mac.
          <template #action>
            <Button @click="router.push('/catalog')">Browse the catalog</Button>
          </template>
        </EmptyState>
      </section>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" class="pb-3 text-lg font-semibold">Activity</h2>
        <!-- A timeline: a hairline spine with one dot per event, each in the
             color that means what happened. -->
        <ol v-if="activity?.length" class="relative flex flex-col">
          <span aria-hidden="true" class="absolute bottom-3 left-[3.5px] top-3 w-px bg-gradient-to-b from-line-strong via-line to-transparent" />
          <li v-for="(a, i) in activity" :key="`${a.at}-${i}`" class="relative flex gap-4 pb-4">
            <span :class="cn('relative mt-[6px] h-2 w-2 shrink-0 rounded-full ring-4 ring-canvas', activityTone(a))" />
            <div class="min-w-0">
              <p class="text-sm leading-snug">{{ a.message }}</p>
              <time
                :datetime="parseServerDate(a.at).toISOString()"
                :title="parseServerDate(a.at).toLocaleString()"
                class="tabular text-xs text-subtle"
              >
                {{ relativeTime(parseServerDate(a.at)) }}
              </time>
            </div>
          </li>
        </ol>
        <p v-else class="text-sm text-muted">Downloads, starts and stops show up here.</p>
      </section>
    </div>

    <ConnectDialog v-if="connectTarget" :model="connectTarget" @close="connectTarget = null" />
  </div>
</template>
