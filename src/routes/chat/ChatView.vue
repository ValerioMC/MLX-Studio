<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ArrowDown, BookOpen, Code2, Lightbulb, Mail, Pencil, Play } from "lucide-vue-next";
import { useConversations, useModels } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { contextSize } from "@/lib/format";
import { useChat } from "@/stores/chat";
import { useLive } from "@/stores/live";
import { usePreferences } from "@/stores/preferences";
import { useUI } from "@/stores/ui";
import { useCoreState } from "@/composables/useCoreState";
import ModelCore from "@/components/instruments/ModelCore.vue";
import ModelFacts from "@/components/models/ModelFacts.vue";
import Button from "@/components/ui/Button.vue";
import Callout from "@/components/ui/Callout.vue";
import Card from "@/components/ui/Card.vue";
import Kbd from "@/components/ui/Kbd.vue";
import Select from "@/components/ui/Select.vue";
import { fieldClass } from "@/components/ui/field";
import ChatSettingsButton from "./ChatSettingsButton.vue";
import Composer from "./Composer.vue";
import ConversationList from "./ConversationList.vue";
import Message from "./Message.vue";
import { regenerate, renameConversation, sendMessage, stopGenerating } from "./useChatSession";

/** Within this distance of the bottom, new output keeps the thread scrolled down. */
const STICK_THRESHOLD_PX = 72;

/**
 * First-message starters on an empty chat: each fills the composer with the
 * start of a request, so the blank box has somewhere obvious to begin.
 */
const STARTERS = [
  { icon: Lightbulb, title: "Explain a concept", prompt: "Explain, in simple terms and with an example: " },
  { icon: Code2, title: "Review some code", prompt: "Review this code for bugs and readability:\n\n" },
  { icon: Mail, title: "Draft a message", prompt: "Draft a short, friendly message that " },
  { icon: BookOpen, title: "Summarize a text", prompt: "Summarize the key points of this text:\n\n" },
] as const;

const router = useRouter();
const { data: models } = useModels();
const { data: conversations } = useConversations();
const live = useLive();
const chat = useChat();
const preferences = usePreferences();
const ui = useUI();
const { stateOf, toneOf } = useCoreState();
const composerRef = ref<InstanceType<typeof Composer> | null>(null);

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
const modelOptions = computed(() =>
  running.value.map((m) => ({
    value: m.id,
    label: m.display_name,
    hint: contextSize(live.stats?.loaded_models.find((l) => l.model_id === m.id)?.context_length ?? 0),
  })),
);
const modelById = computed(() => new Map(running.value.map((m) => [m.id, m])));

function send(text: string, images: string[]): void {
  // Pin the model the reply comes from, so every "generating" core (rail,
  // dial, this thread) lights on the right one.
  if (!chat.model || !running.value.some((m) => m.id === chat.model)) chat.model = active.value;
  void sendMessage(active.value, text, images);
}

function useStarter(prompt: string): void {
  chat.input = prompt;
  composerRef.value?.focus();
}

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
  titleInputRef.value?.select();
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
</script>

<template>
  <div class="flex h-full min-h-0">
    <ConversationList />

    <section class="relative flex min-w-0 flex-1 flex-col">
      <!-- The header shares the window's title-bar strip, glass over the thread. -->
      <header
        data-tauri-drag-region
        class="glass absolute inset-x-0 top-0 z-sticky flex h-[60px] items-center justify-between gap-4 border-b border-line/60 px-6"
      >
        <input
          v-if="editingTitle && chat.conversationId"
          ref="titleInputRef"
          v-model="titleDraft"
          aria-label="Chat title"
          maxlength="48"
          :class="cn(fieldClass, 'no-drag h-control max-w-[26rem] text-md font-semibold')"
          @blur="saveTitle"
          @keydown.enter="saveTitle"
          @keydown.esc="editingTitle = false"
        />
        <h1 v-else class="no-drag group flex min-w-0 items-center gap-1.5 text-md font-semibold">
          <span class="truncate">{{ title }}</span>
          <button
            v-if="chat.conversationId"
            type="button"
            aria-label="Rename chat"
            title="Rename"
            class="grid h-6 w-6 shrink-0 place-items-center rounded-control text-subtle opacity-0 transition-opacity hover:bg-fg/[0.06] hover:text-fg focus-visible:opacity-100 group-hover:opacity-100"
            @click="startEditTitle"
          >
            <Pencil class="h-3 w-3" />
          </button>
        </h1>

        <div class="no-drag flex items-center gap-1.5">
          <div v-if="running.length > 0" class="w-[12rem] lg:w-[15rem]">
            <Select
              :model-value="active"
              :options="modelOptions"
              label="Model"
              size="sm"
              :disabled="chat.busy"
              @update:model-value="chat.model = $event"
            >
              <template #value="{ option }">
                <ModelCore
                  v-if="option && modelById.get(option.value)"
                  :state="stateOf(modelById.get(option.value)!)"
                  :tone="toneOf(modelById.get(option.value)!)"
                  :size="14"
                />
                <span class="truncate">{{ option?.label }}</span>
              </template>
              <template #option="{ option }">
                <ModelCore
                  v-if="modelById.get(option.value)"
                  :state="stateOf(modelById.get(option.value)!)"
                  :tone="toneOf(modelById.get(option.value)!)"
                  :size="14"
                />
                <span class="truncate">{{ option.label }}</span>
              </template>
            </Select>
          </div>
          <ChatSettingsButton />
        </div>
      </header>

      <div
        ref="scrollRef"
        class="min-h-0 flex-1 overflow-y-auto px-8 pt-[60px]"
        @scroll="onScroll"
      >
        <!-- No model running: start one, right here. -->
        <div
          v-if="chat.messages.length === 0 && !activeModel && models"
          class="mx-auto flex w-full max-w-[36rem] flex-col items-center gap-5 pt-[12vh] text-center"
        >
          <ModelCore state="idle" :size="64" />
          <div>
            <h2 class="text-2xl font-semibold">Start a model to chat</h2>
            <p class="pt-1.5 text-md text-muted">
              {{
                installed.length
                  ? "Pick one of your installed models. It stays loaded until you stop it."
                  : "You have no chat models yet. Download one from the catalog first."
              }}
            </p>
          </div>
          <Card v-if="installed.length > 0" class="w-full overflow-hidden text-left">
            <ul class="divide-y divide-line">
              <li v-for="m in installed" :key="m.id" class="flex items-center gap-3 px-4 py-3">
                <ModelCore :state="stateOf(m)" :size="18" />
                <span class="min-w-0 flex-1 truncate text-md font-medium">{{ m.display_name }}</span>
                <ModelFacts :model="m" />
                <Button variant="secondary" size="sm" @click="ui.requestStart(m, 'open-chat')">
                  <Play class="!h-3 !w-3 fill-current" />
                  Start
                </Button>
              </li>
            </ul>
          </Card>
          <Button v-else @click="router.push('/catalog')">Browse the catalog</Button>
        </div>

        <!-- A running model and an empty thread: introduce it, offer a start. -->
        <div
          v-if="chat.messages.length === 0 && activeModel"
          class="mx-auto flex w-full max-w-prose flex-col items-center pt-[10vh] text-center"
        >
          <div class="relative">
            <div
              aria-hidden="true"
              class="absolute inset-[-60px] rounded-full bg-[radial-gradient(circle,rgb(var(--accent)/0.14),transparent_65%)]"
            />
            <ModelCore :state="stateOf(activeModel)" :tone="toneOf(activeModel)" :size="72" />
          </div>
          <h2 class="pt-6 text-3xl font-semibold">{{ activeModel.display_name }}</h2>
          <div class="flex items-center gap-2 pt-2.5 text-sm text-muted">
            <ModelFacts :model="activeModel" />
            <span v-if="contextLength" class="tabular">{{ contextSize(contextLength) }} context</span>
          </div>
          <p class="pt-3 text-md text-muted">Everything you send stays on this Mac.</p>

          <div class="grid w-full grid-cols-2 gap-2.5 pt-10">
            <Card
              v-for="s in STARTERS"
              :key="s.title"
              interactive
              as="button"
              type="button"
              class="group flex items-center gap-3 p-3.5 text-left"
              @click="useStarter(s.prompt)"
            >
              <span
                class="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-fg/[0.05] text-muted ring-1 ring-inset ring-line transition-colors group-hover:bg-accent-soft group-hover:text-accent-text group-hover:ring-accent-line"
              >
                <component :is="s.icon" class="h-4 w-4" />
              </span>
              <span class="text-base font-medium">{{ s.title }}</span>
            </Card>
          </div>
        </div>

        <div v-if="chat.messages.length > 0" class="mx-auto flex w-full max-w-prose flex-col gap-8 pb-10 pt-8">
          <Message
            v-for="(m, i) in chat.messages"
            :key="m.id"
            :message="m"
            :is-last="i === chat.messages.length - 1"
            :on-regenerate="i === chat.messages.length - 1 && active ? () => regenerate(active) : undefined"
            :max-tokens="preferences.maxTokens"
            :tone="activeModel ? toneOf(activeModel) : 0"
          />
        </div>
      </div>

      <Transition name="popover">
        <button
          v-if="showJump"
          type="button"
          class="glass absolute bottom-[7.5rem] left-1/2 z-sticky flex h-control-sm -translate-x-1/2 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-sm font-medium shadow-modal transition-colors hover:text-accent-text"
          @click="scrollToBottom(true)"
        >
          <ArrowDown class="h-3.5 w-3.5" />
          Jump to latest
        </button>
      </Transition>

      <div class="relative shrink-0 px-8 pb-5">
        <!-- The thread fades out under the dock instead of being cut by it. -->
        <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-canvas/80 to-transparent" />
        <div class="relative mx-auto w-full max-w-prose">
          <Callout v-if="selectedStopped && activeModel" tone="warn" class="mb-2.5">
            The model this chat used is not running. Replies will come from {{ activeModel.display_name }}.
          </Callout>
          <Composer
            ref="composerRef"
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
            @send="send"
            @stop="stopGenerating"
          />
          <p class="flex items-center justify-center gap-1.5 pt-2 text-2xs text-subtle">
            <Kbd>↵</Kbd> send <span class="px-1">·</span> <Kbd>⇧</Kbd><Kbd>↵</Kbd> new line
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
