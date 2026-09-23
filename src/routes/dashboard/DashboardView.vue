<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Code2, MessageSquare, Play, Square } from "lucide-vue-next";
import { useActivity, useModels } from "@/lib/api/queries";
import { useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import { useMemoryLedger } from "@/composables/useMemoryLedger";
import FreeForModels from "@/components/system/FreeForModels.vue";
import LedgerBar from "@/components/system/LedgerBar.vue";
import LedgerLegend from "@/components/system/LedgerLegend.vue";
import StartModelDialog from "@/components/models/StartModelDialog.vue";
import ConnectDialog from "@/components/models/ConnectDialog.vue";
import ModelFacts from "@/components/models/ModelFacts.vue";
import { useModelAction } from "@/components/models/useModelActions";
import Button from "@/components/ui/Button.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StatusDot from "@/components/ui/StatusDot.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import { bytes, contextSize } from "@/lib/format";
import { parseServerDate, relativeTime } from "@/lib/time";
import type { Model } from "@/types";

/** Swap above this means macOS is short on memory and generation will crawl. */
const SWAP_WARNING_BYTES = 1024 ** 3;
const QUICK_START_LIMIT = 4;

const router = useRouter();
const live = useLive();
const ledger = useMemoryLedger();
const { data: models, isLoading: modelsLoading } = useModels();
const { data: activity } = useActivity();
const chat = useChat();
const { mutate: stopModel, isPending: stopping, variables: stopVariables } = useModelAction("stop");
const startTarget = ref<Model | null>(null);
const connectTarget = ref<Model | null>(null);

const running = computed(() => models.value?.filter((m) => m.status === "running") ?? []);
const idle = computed(() => models.value?.filter((m) => m.status !== "running" && m.chat_capable !== false) ?? []);
const loaded = computed(() => new Map(live.stats?.loaded_models.map((m) => [m.model_id, m]) ?? []));

function openChat(model: Model): void {
  chat.model = model.id;
  void router.push("/chat");
}
</script>

<template>
  <div>
    <PageHeader title="Overview" />

    <section aria-label="Unified memory" class="flex flex-col gap-4 pb-10">
      <template v-if="ledger && live.stats">
        <div class="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <FreeForModels :ledger="ledger" />
          <dl class="flex gap-6 pb-1 text-sm">
            <div>
              <dt class="text-muted-foreground">Disk free</dt>
              <dd class="tabular font-medium">{{ bytes(live.stats.disk_free) }}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">CPU</dt>
              <dd class="tabular font-medium">{{ Math.round(live.stats.cpu_percent) }}%</dd>
            </div>
          </dl>
        </div>
        <LedgerBar :ledger="ledger" height="h-9" class="rounded-[7px] p-[3px]" />
        <LedgerLegend :ledger="ledger" />
        <p v-if="live.stats.swap_used > SWAP_WARNING_BYTES" class="text-sm text-caution">
          macOS is swapping {{ bytes(live.stats.swap_used) }} to disk, so generation will be slow. Stop a model or
          start it with a shorter context.
        </p>
      </template>
      <div v-else class="flex flex-col gap-4" aria-busy="true">
        <Skeleton variant="block" class="h-[3.7rem] w-80" />
        <Skeleton variant="block" class="h-9 rounded-[7px]" />
      </div>
    </section>

    <div class="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <section aria-labelledby="running-heading">
        <h2 id="running-heading" class="pb-2 text-md font-semibold">
          {{ running.length ? "Running" : "Start a model" }}
        </h2>

        <ul v-if="running.length > 0" class="divide-y border-y">
          <li v-for="m in running" :key="m.id" class="flex items-center gap-3 py-3">
            <StatusDot tone="positive" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-md font-medium">{{ m.display_name }}</p>
              <p class="flex items-center gap-2 pt-0.5 text-sm text-muted-foreground">
                <ModelFacts :model="m" />
                <span v-if="loaded.get(m.id)" class="tabular">
                  {{ contextSize(loaded.get(m.id)!.context_length) }} context
                </span>
                <span v-if="loaded.get(m.id)?.est_ram_bytes != null" class="tabular">
                  {{ bytes(loaded.get(m.id)!.est_ram_bytes) }}
                </span>
              </p>
            </div>
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
              <Square v-if="!(stopping && stopVariables === m.id)" class="fill-current" />
              Stop
            </Button>
          </li>
        </ul>

        <ul v-if="running.length === 0 && idle.length > 0" class="divide-y border-y">
          <li v-for="m in idle.slice(0, QUICK_START_LIMIT)" :key="m.id" class="flex items-center gap-3 py-3">
            <StatusDot tone="idle" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-md font-medium">{{ m.display_name }}</p>
              <p class="pt-0.5">
                <ModelFacts :model="m" />
              </p>
            </div>
            <Button variant="secondary" size="sm" @click="startTarget = m">
              <Play />
              Start
            </Button>
          </li>
        </ul>
        <RouterLink
          v-if="running.length === 0 && idle.length > QUICK_START_LIMIT"
          to="/models"
          class="mt-2 inline-block text-sm text-accent hover:underline"
        >
          All {{ idle.length }} installed models
        </RouterLink>

        <EmptyState v-if="!modelsLoading && models?.length === 0" title="No models yet">
          Download an MLX model from Hugging Face. Anything marked “Fits” runs well on this Mac.
          <template #action>
            <Button @click="router.push('/catalog')">Browse the catalog</Button>
          </template>
        </EmptyState>
      </section>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" class="pb-2 text-md font-semibold">Activity</h2>
        <ol v-if="activity?.length" class="flex flex-col">
          <li v-for="(a, i) in activity" :key="`${a.at}-${i}`" class="grid grid-cols-[4.5rem_1fr] gap-3 py-1.5 text-sm">
            <time
              :datetime="parseServerDate(a.at).toISOString()"
              :title="parseServerDate(a.at).toLocaleString()"
              class="tabular text-muted-foreground"
            >
              {{ relativeTime(parseServerDate(a.at)) }}
            </time>
            <span class="min-w-0 break-words">{{ a.message }}</span>
          </li>
        </ol>
        <p v-else class="text-sm text-muted-foreground">Downloads, starts and stops show up here.</p>
      </section>
    </div>

    <StartModelDialog
      v-if="startTarget"
      :model="startTarget"
      @close="startTarget = null"
      @started="
        (m) => {
          startTarget = null;
          openChat(m);
        }
      "
    />
    <ConnectDialog v-if="connectTarget" :model="connectTarget" @close="connectTarget = null" />
  </div>
</template>
