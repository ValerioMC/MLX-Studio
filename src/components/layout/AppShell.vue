<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import Sidebar from "./Sidebar.vue";
import ConnectionBanner from "@/components/system/ConnectionBanner.vue";
import { useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import { NAV_ITEMS, SETTINGS_ITEM } from "./navigation";

const route = useRoute();
const router = useRouter();
const live = useLive();
const chat = useChat();

const SHORTCUT_ROUTES = new Map([...NAV_ITEMS, SETTINGS_ITEM].map((item) => [item.shortcut, item.to]));

/** App-wide keyboard map: ⌘1–5 and ⌘, switch pages, ⌘N starts a new chat. */
function onKey(event: KeyboardEvent): void {
  if (!event.metaKey || event.altKey || event.ctrlKey) return;
  const to = SHORTCUT_ROUTES.get(event.key);
  if (to) {
    event.preventDefault();
    void router.push(to);
    return;
  }
  if (event.key.toLowerCase() === "n" && !event.shiftKey) {
    event.preventDefault();
    if (!chat.busy) chat.reset();
    void router.push("/chat");
  }
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
      listen<string>(TRAY_OPEN_CHAT_EVENT, ({ payload }) => {
        chat.model = payload;
        void router.push("/chat");
      }).then((stop) => {
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
  <!-- No bg-background here on purpose: the ambient wash lives on <body>, and this
       root has to stay transparent for it to show through the main content area
       (the sidebar paints its own opaque bg-sidebar over it). -->
  <div class="flex h-screen w-screen overflow-hidden text-foreground">
    <Sidebar />
    <main class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
      <div data-tauri-drag-region class="h-12 w-full shrink-0" />
      <ConnectionBanner />
      <div :key="fullBleed ? 'chat' : 'page'" class="no-drag min-h-0 flex-1 overflow-y-auto">
        <RouterView v-if="fullBleed" v-slot="{ Component }">
          <Transition name="pane-fade" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
        <div v-else class="mx-auto w-full max-w-[64rem] px-8 pb-16">
          <RouterView v-slot="{ Component }">
            <Transition name="pane-fade" mode="out-in">
              <component :is="Component" :key="route.path" />
            </Transition>
          </RouterView>
        </div>
      </div>
    </main>
  </div>
</template>
