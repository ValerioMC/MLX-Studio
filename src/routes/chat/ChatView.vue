<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ArrowDown, Pencil, Play } from "lucide-vue-next";
import { useConversations, useModels } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { contextSize } from "@/lib/format";
import { useChat } from "@/stores/chat";
import { useLive } from "@/stores/live";
import { usePreferences } from "@/stores/preferences";
import StartModelDialog from "@/components/models/StartModelDialog.vue";
import ModelFacts from "@/components/models/ModelFacts.vue";
import Button from "@/components/ui/Button.vue";
import StatusDot from "@/components/ui/StatusDot.vue";
import { fieldClass } from "@/components/ui/field";
import ChatSettingsButton from "./ChatSettingsButton.vue";
import Composer from "./Composer.vue";
import ConversationList from "./ConversationList.vue";
import Message from "./Message.vue";
import { regenerate, renameConversation, sendMessage, stopGenerating } from "./useChatSession";
import type { Model } from "@/types";

/** Within this distance of the bottom, new output keeps the thread scrolled down. */
const STICK_THRESHOLD_PX = 72;

const router = useRouter();
const { data: models } = useModels();
const { data: conversations } = useConversations();
const live = useLive();
const chat = useChat();
const preferences = usePreferences();
const startTarget = ref<Model | null>(null);

const running = computed(() => models.value?.filter((m) => m.status === "running") ?? []);
const installed = computed(() => models.value?.filter((m) => m.status !== "running" && m.chat_capable !== false) ?? []);
const activeModel = computed(() => running.value.find((m) => m.id === chat.model) ?? running.value[0]);
const active = computed(() => activeModel.value?.id ?? "");
const selectedStopped = computed(
  () => chat.model !== "" && !running.value.some((m) => m.id === chat.model) && chat.messages.length > 0,
);
const contextLength = computed(
  () => live.stats?.loaded_models.find((m) => m.model_id === active.value)?.context_length,
);

// --- conversation title
const editingTitle = ref(false);
const titleDraft = ref("");
const titleInputRef = ref<HTMLInputElement | null>(null);
const title = computed(() => {
  const found = conversations.value?.find((c) => c.id === chat.conversationId)?.title;
  return found || (chat.conversationId ? "Untitled chat" : "New chat");
});
function startEditTitle(): void {
  titleDraft.value = title.value;
  editingTitle.value = true;
}
async function saveTitle(): Promise<void> {
  const next = titleDraft.value.trim();
  editingTitle.value = false;
  if (next && chat.conversationId && next !== title.value) {
    await renameConversation(chat.conversationId, next).catch(() => undefined);
  }
}
watch(editingTitle, async (editing) => {
  if (!editing) return;
  await nextTick();
  titleInputRef.value?.focus();
});

// --- scrolling: follow new output only while the reader is at the bottom.
const scrollRef = ref<HTMLDivElement | null>(null);
const stick = ref(true);
const showJump = ref(false);

function scrollToBottom(smooth: boolean): void {
  const el = scrollRef.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  stick.value = true;
  showJump.value = false;
}

watch(
  () => chat.messages,
  async () => {
    await nextTick();
    if (stick.value) scrollToBottom(false);
    else showJump.value = true;
  },
  { deep: true },
);

// A new question always brings the answer into view.
watch(
  () => [chat.messages.length, chat.messages[chat.messages.length - 1]?.role, chat.busy] as const,
  ([, lastRole, busy]) => {
    if (lastRole === "assistant" && busy) scrollToBottom(false);
  },
);

function onScroll(): void {
  const el = scrollRef.value;
  if (!el) return;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD_PX;
  stick.value = atBottom;
  if (atBottom) showJump.value = false;
}

function startModel(model: Model): void {
  startTarget.value = model;
}
</script>

<template>
  <div class="flex h-full min-h-0">
    <ConversationList />

    <section class="relative flex min-w-0 flex-1 flex-col">
      <header class="flex h-10 shrink-0 items-center justify-between gap-4 px-6">
        <input
          v-if="editingTitle && chat.conversationId"
          ref="titleInputRef"
          v-model="titleDraft"
          aria-label="Chat title"
          maxlength="48"
          :class="cn(fieldClass, 'h-8 max-w-[24rem] text-lg font-semibold')"
          @blur="saveTitle"
          @keydown.enter="saveTitle"
          @keydown.esc="editingTitle = false"
        />
        <h1 v-else class="group flex min-w-0 items-center gap-1.5 text-lg font-semibold">
          <span class="truncate">{{ title }}</span>
          <button
            v-if="chat.conversationId"
            type="button"
            aria-label="Rename chat"
            title="Rename"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            @click="startEditTitle"
          >
            <Pencil class="h-3 w-3" />
          </button>
        </h1>

        <div class="flex items-center gap-1.5">
          <select
            v-if="running.length > 0"
            :value="active"
            aria-label="Model"
            :disabled="chat.busy"
            :class="cn(fieldClass, 'h-7 w-auto max-w-[16rem] pr-7 text-sm')"
            @change="chat.model = ($event.target as HTMLSelectElement).value"
          >
            <option v-for="m in running" :key="m.id" :value="m.id">{{ m.display_name }}</option>
          </select>
          <ChatSettingsButton />
        </div>
      </header>

      <div
        ref="scrollRef"
        class="min-h-0 flex-1 overflow-y-auto px-6 [mask-image:linear-gradient(to_bottom,transparent,black_20px)]"
        @scroll="onScroll"
      >
        <div
          v-if="chat.messages.length === 0 && !activeModel && models"
          class="mx-auto flex w-full max-w-[34rem] flex-col gap-4 pt-[12vh]"
        >
          <div>
            <h2 class="text-xl font-semibold">Start a model to chat</h2>
            <p class="pt-1 text-md text-muted-foreground">
              {{
                installed.length
                  ? "Pick one of your installed models. It stays loaded until you stop it."
                  : "You have no chat models yet. Download one from the catalog first."
              }}
            </p>
          </div>
          <ul v-if="installed.length > 0" class="divide-y border-y">
            <li v-for="m in installed" :key="m.id" class="flex items-center gap-3 py-2.5">
              <StatusDot tone="idle" />
              <span class="min-w-0 flex-1 truncate text-md font-medium">{{ m.display_name }}</span>
              <ModelFacts :model="m" />
              <Button variant="secondary" size="sm" @click="startModel(m)">
                <Play />
                Start
              </Button>
            </li>
          </ul>
          <div v-else>
            <Button @click="router.push('/catalog')">Browse the catalog</Button>
          </div>
        </div>

        <div
          v-if="chat.messages.length === 0 && activeModel"
          class="mx-auto flex w-full max-w-[44rem] flex-col items-start gap-2 pt-[18vh]"
        >
          <p class="flex items-center gap-2 text-sm text-muted-foreground">
            <StatusDot tone="positive" />
            Running{{ contextLength ? ` with ${contextSize(contextLength)} context` : "" }}
          </p>
          <h2 class="text-2xl font-semibold">{{ activeModel.display_name }}</h2>
          <ModelFacts :model="activeModel" />
          <p class="pt-2 text-md text-muted-foreground">Everything you send stays on this Mac.</p>
        </div>

        <div v-if="chat.messages.length > 0" class="mx-auto flex w-full max-w-[44rem] flex-col gap-7 pb-8 pt-4">
          <Message
            v-for="(m, i) in chat.messages"
            :key="m.id"
            :message="m"
            :is-last="i === chat.messages.length - 1"
            :on-regenerate="i === chat.messages.length - 1 && active ? () => regenerate(active) : undefined"
            :max-tokens="preferences.maxTokens"
          />
        </div>
      </div>

      <button
        v-if="showJump"
        type="button"
        class="absolute bottom-[6.5rem] left-1/2 flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-full bg-card px-3 text-sm font-medium shadow-dialog hover:bg-muted"
        @click="scrollToBottom(true)"
      >
        <ArrowDown class="h-3.5 w-3.5" />
        Jump to latest
      </button>

      <div class="shrink-0 px-6 pb-5 pt-2">
        <div class="mx-auto w-full max-w-[44rem]">
          <p v-if="selectedStopped && activeModel" class="pb-2 text-sm text-caution">
            The model this chat used is not running. Replies will come from {{ activeModel.display_name }}.
          </p>
          <Composer
            :key="activeModel?.vision ? 'vision' : 'text'"
            :disabled="!active"
            :can-attach="!!activeModel?.vision"
            :placeholder="
              !active
                ? 'Start a model to send a message'
                : activeModel?.vision
                  ? `Message ${activeModel.display_name}, or drop an image`
                  : `Message ${activeModel?.display_name ?? ''}`
            "
            @send="(text, images) => sendMessage(active, text, images)"
            @stop="stopGenerating"
          />
          <p class="pt-1.5 text-center text-2xs text-muted-foreground">Enter to send, Shift+Enter for a new line</p>
        </div>
      </div>
    </section>

    <StartModelDialog
      v-if="startTarget"
      :model="startTarget"
      @close="startTarget = null"
      @started="
        (m) => {
          startTarget = null;
          chat.model = m.id;
        }
      "
    />
  </div>
</template>
