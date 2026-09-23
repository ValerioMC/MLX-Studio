<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { Search } from "lucide-vue-next";
import { useModels } from "@/lib/api/queries";
import { activeDownloadCount, useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import { useUI } from "@/stores/ui";
import { useMemoryLedger } from "@/composables/useMemoryLedger";
import { useCoreState } from "@/composables/useCoreState";
import MemoryCells from "@/components/instruments/MemoryCells.vue";
import ModelCore from "@/components/instruments/ModelCore.vue";
import Kbd from "@/components/ui/Kbd.vue";
import { contextSize, gigabytes } from "@/lib/format";
import BrandMark from "./BrandMark.vue";
import NavRow from "./NavRow.vue";
import { NAV_ITEMS, SETTINGS_ITEM } from "./navigation";

const router = useRouter();
const { data: models } = useModels();
const live = useLive();
const chat = useChat();
const ui = useUI();
const ledger = useMemoryLedger();
const { stateOf, toneOf } = useCoreState();

const running = computed(() => models.value?.filter((m) => m.status === "running") ?? []);
const contextOf = computed(
  () => new Map(live.stats?.loaded_models.map((m) => [m.model_id, m.context_length]) ?? []),
);
const activeDownloads = computed(() => activeDownloadCount(live.downloads));

function openChat(modelId: string): void {
  chat.model = modelId;
  void router.push("/chat");
}
</script>

<template>
  <!-- The rail: glass over the room's light, so the ambient wash reaches the
       whole window instead of stopping at an opaque sidebar. -->
  <aside class="glass relative flex h-full w-rail shrink-0 flex-col border-r border-line/80">
    <!-- Room for the traffic lights; doubles as a window drag handle. -->
    <div data-tauri-drag-region class="h-titlebar shrink-0" />

    <div data-tauri-drag-region class="flex items-center gap-2 px-4 pb-5">
      <BrandMark />
      <div class="min-w-0 leading-tight">
        <p class="text-md font-semibold tracking-[-0.015em]">MLX Studio</p>
        <p class="text-2xs text-subtle">Local models on this Mac</p>
      </div>
    </div>

    <div class="no-drag px-3 pb-4">
      <button
        type="button"
        class="field flex h-control w-full items-center gap-2 rounded-control px-2.5 text-left text-sm text-subtle"
        @click="ui.paletteOpen = true"
      >
        <Search class="h-3.5 w-3.5 shrink-0" />
        <span class="flex-1">Search or jump to…</span>
        <Kbd>⌘K</Kbd>
      </button>
    </div>

    <nav aria-label="Main" class="no-drag flex flex-col gap-0.5 px-3">
      <NavRow
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :item="item"
        :badge="item.to === '/downloads' ? activeDownloads : undefined"
      />
    </nav>

    <section aria-labelledby="rail-running" class="no-drag mt-7 min-h-0 px-3">
      <h2 id="rail-running" class="flex items-center justify-between px-2.5 pb-1.5 text-xs font-medium text-subtle">
        Running
        <span class="tabular">{{ running.length }}</span>
      </h2>
      <TransitionGroup v-if="running.length > 0" tag="ul" name="list" class="relative flex flex-col gap-0.5">
        <li v-for="m in running" :key="m.id">
          <button
            type="button"
            :title="`Chat with ${m.display_name}`"
            class="group flex h-row w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm transition-colors hover:bg-fg/[0.045]"
            @click="openChat(m.id)"
          >
            <ModelCore :state="stateOf(m)" :tone="toneOf(m)" :size="15" />
            <span class="min-w-0 flex-1 truncate font-medium text-fg/90">{{ m.display_name }}</span>
            <span v-if="contextOf.has(m.id)" class="tabular font-mono text-2xs text-subtle">
              {{ contextSize(contextOf.get(m.id) ?? 0) }}
            </span>
          </button>
        </li>
      </TransitionGroup>
      <p v-else class="px-2.5 text-sm text-subtle">Nothing loaded.</p>
    </section>

    <div class="no-drag mt-auto flex flex-col gap-1 px-3 pb-3">
      <RouterLink
        v-if="ledger"
        to="/"
        title="Unified memory"
        class="mb-1 flex flex-col gap-2 rounded-card border border-line/80 bg-canvas/40 p-3 transition-colors hover:border-line-strong"
      >
        <div class="flex items-baseline justify-between">
          <span class="text-xs text-muted">Free for models</span>
          <span class="tabular text-sm font-semibold">
            {{ gigabytes(ledger.freeForModelsBytes) }}
            <span class="font-normal text-subtle">/ {{ gigabytes(ledger.totalBytes) }} GB</span>
          </span>
        </div>
        <MemoryCells :ledger="ledger" height="sm" :max-cells="40" />
      </RouterLink>
      <NavRow :item="SETTINGS_ITEM" />
    </div>
  </aside>
</template>
