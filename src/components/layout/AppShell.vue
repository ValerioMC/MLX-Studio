<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import Sidebar from "./Sidebar.vue";
import CommandPalette from "./CommandPalette.vue";
import ConnectionBanner from "@/components/system/ConnectionBanner.vue";
import StartModelDialog from "@/components/models/StartModelDialog.vue";
import Toaster from "@/components/ui/Toaster.vue";
import { useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import { useUI } from "@/stores/ui";
import { useToasts } from "@/stores/toast";
import type { Model } from "@/types";
import { NAV_ITEMS, SETTINGS_ITEM } from "./navigation";

const route = useRoute();
const router = useRouter();
const live = useLive();
const chat = useChat();
const ui = useUI();
const toasts = useToasts();

const SHORTCUT_ROUTES = new Map([...NAV_ITEMS, SETTINGS_ITEM].map((item) => [item.shortcut, item.to]));

/** App-wide keyboard map: ⌘1–5 and ⌘, switch pages, ⌘N starts a new chat, ⌘K opens the palette. */
function onKey(event: KeyboardEvent): void {
  if (!event.metaKey || event.altKey || event.ctrlKey) return;
  const key = event.key.toLowerCase();
  if (key === "k") {
    event.preventDefault();
    ui.paletteOpen = !ui.paletteOpen;
    return;
  }
  const to = SHORTCUT_ROUTES.get(event.key);
  if (to) {
    event.preventDefault();
    ui.paletteOpen = false;
    void router.push(to);
    return;
  }
  if (key === "n" && !event.shiftKey) {
    event.preventDefault();
    if (!chat.busy) chat.reset();
    void router.push("/chat");
  }
}

function openChat(modelId: string): void {
  chat.model = modelId;
  void router.push("/chat");
}

/** The shared Start dialog finished loading a model. */
function onStarted(model: Model): void {
  const after = ui.startRequest?.after;
  ui.startRequest = null;
  if (after === "open-chat") {
    openChat(model.id);
    return;
  }
  toasts.notify(`${model.display_name} is running`, {
    detail: "Loaded into memory and answering on the local API.",
    action: { label: "Open chat", run: () => openChat(model.id) },
  });
}

/** Event the menu-bar item sends to open Chat with a model (see src-tauri/src/tray.rs). */
const TRAY_OPEN_CHAT_EVENT = "tray:open-chat";

let stopFeeds: (() => void) | undefined;
let unlistenTray: (() => void) | undefined;

onMounted(() => {
  stopFeeds = live.startFeeds();
  window.addEventListener("keydown", onKey);

  if ("__TAURI_INTERNALS__" in window) {
    // The menu-bar item's "Open chat": select that model and go to Chat.
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen<string>(TRAY_OPEN_CHAT_EVENT, ({ payload }) => openChat(payload)).then((stop) => {
        unlistenTray = stop;
      }),
    );
  }
});
onUnmounted(() => {
  stopFeeds?.();
  window.removeEventListener("keydown", onKey);
  unlistenTray?.();
});

// Chat owns its full height (thread + composer); other pages scroll.
const fullBleed = computed(() => route.path === "/chat");
</script>

<template>
  <!-- Transparent on purpose: the room's light lives on <body>, and every pane
       here is glass or floats over it. -->
  <div class="flex h-screen w-screen overflow-hidden text-fg">
    <Sidebar />
    <main class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <div data-tauri-drag-region class="absolute inset-x-0 top-0 z-sticky h-titlebar" />
      <div :key="fullBleed ? 'chat' : 'page'" class="no-drag min-h-0 flex-1 overflow-y-auto">
        <RouterView v-if="fullBleed" v-slot="{ Component }">
          <Transition name="pane" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
        <div v-else class="mx-auto w-full max-w-page px-10 pb-20 pt-titlebar">
          <ConnectionBanner />
          <RouterView v-slot="{ Component }">
            <Transition name="pane" mode="out-in">
              <component :is="Component" :key="route.path" />
            </Transition>
          </RouterView>
        </div>
      </div>
    </main>

    <CommandPalette v-if="ui.paletteOpen" />
    <StartModelDialog
      v-if="ui.startRequest"
      :key="ui.startRequest.model.id"
      :model="ui.startRequest.model"
      @close="ui.startRequest = null"
      @started="onStarted"
    />
    <Toaster />
  </div>
</template>
