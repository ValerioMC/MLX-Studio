<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useModels } from "@/lib/api/queries";
import { activeDownloadCount, useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import { useMemoryLedger } from "@/composables/useMemoryLedger";
import LedgerBar from "@/components/system/LedgerBar.vue";
import FreeForModels from "@/components/system/FreeForModels.vue";
import StatusDot from "@/components/ui/StatusDot.vue";
import { contextSize } from "@/lib/format";
import NavRow from "./NavRow.vue";
import { NAV_ITEMS, SETTINGS_ITEM } from "./navigation";

const router = useRouter();
const { data: models } = useModels();
const live = useLive();
const chat = useChat();
const ledger = useMemoryLedger();

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
  <aside class="flex h-full w-[13.5rem] shrink-0 flex-col border-r bg-sidebar">
    <!-- Room for the traffic lights; doubles as a window drag handle. -->
    <div data-tauri-drag-region class="h-12 shrink-0" />

    <div data-tauri-drag-region class="px-4 pb-4">
      <span class="text-md font-semibold tracking-[-0.01em]">MLX Studio</span>
    </div>

    <nav aria-label="Main" class="no-drag flex flex-col gap-px px-2">
      <NavRow
        v-for="item in NAV_ITEMS"
        :key="item.to"
        :item="item"
        :badge="item.to === '/downloads' ? activeDownloads : undefined"
      />
    </nav>

    <section v-if="running.length > 0" aria-label="Running models" class="no-drag mt-6 px-2">
      <h2 class="px-2 pb-1 text-xs font-medium text-muted-foreground">Running</h2>
      <ul class="flex flex-col gap-px">
        <li v-for="m in running" :key="m.id">
          <button
            type="button"
            :title="`Chat with ${m.display_name}`"
            class="flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-foreground/90 transition-colors hover:bg-foreground/[0.04]"
            @click="openChat(m.id)"
          >
            <StatusDot tone="positive" class="mx-1" />
            <span class="min-w-0 flex-1 truncate">{{ m.display_name }}</span>
            <span v-if="contextOf.has(m.id)" class="tabular text-2xs text-muted-foreground">
              {{ contextSize(contextOf.get(m.id) ?? 0) }}
            </span>
          </button>
        </li>
      </ul>
    </section>

    <div class="no-drag mt-auto flex flex-col gap-2 px-2 pb-3">
      <RouterLink
        v-if="ledger"
        to="/"
        title="Unified memory"
        class="flex flex-col gap-1.5 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.04]"
      >
        <LedgerBar :ledger="ledger" height="h-2.5" class="p-[1.5px]" />
        <FreeForModels :ledger="ledger" size="compact" />
      </RouterLink>
      <NavRow :item="SETTINGS_ITEM" />
    </div>
  </aside>
</template>
