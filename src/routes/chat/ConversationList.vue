<script setup lang="ts">
import { ref, computed } from "vue";
import { Search, SquarePen, Trash2 } from "lucide-vue-next";
import { useConversations } from "@/lib/api/queries";
import { groupByDate, parseServerDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat";
import { useToasts } from "@/stores/toast";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Button from "@/components/ui/Button.vue";
import type { Conversation } from "@/types";
import { deleteConversation, openConversation } from "./useChatSession";

const { data: conversations } = useConversations();
const chat = useChat();
const toasts = useToasts();
const deleteTarget = ref<Conversation | null>(null);
const deleting = ref(false);
const filter = ref("");

const titleOf = (c: Conversation) => c.title || "Untitled chat";
const visible = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  const all = conversations.value ?? [];
  return needle ? all.filter((c) => titleOf(c).toLowerCase().includes(needle)) : all;
});
const groups = computed(() => groupByDate(visible.value, (c) => parseServerDate(c.updated_at)));

function open(c: Conversation): void {
  openConversation(c).catch((error: unknown) => toasts.notifyError(error, "Could not open that chat"));
}

function confirmDelete(): void {
  const target = deleteTarget.value;
  if (!target) return;
  deleting.value = true;
  deleteConversation(target.id)
    .catch((error: unknown) => toasts.notifyError(error, "Could not delete the chat"))
    .finally(() => {
      deleting.value = false;
      deleteTarget.value = null;
    });
}
</script>

<template>
  <aside aria-label="Conversations" class="glass flex w-[13.5rem] shrink-0 flex-col border-r border-line/80 lg:w-list">
    <div data-tauri-drag-region class="flex h-[60px] shrink-0 items-center justify-between border-b border-line/60 px-4">
      <h2 class="text-md font-semibold">Chats</h2>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="New chat"
        title="New chat (⌘N)"
        :disabled="chat.busy"
        class="-mr-1.5"
        @click="chat.reset()"
      >
        <SquarePen />
      </Button>
    </div>

    <div class="px-3 pb-1 pt-3">
      <label class="field flex h-control-sm items-center gap-2 rounded-control px-2.5">
        <Search class="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
        <input
          v-model="filter"
          aria-label="Filter chats"
          placeholder="Filter chats"
          spellcheck="false"
          class="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
          @keydown.esc="filter = ''"
        />
      </label>
    </div>

    <nav class="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      <section v-for="group in groups" :key="group.group" class="pt-3">
        <h3 class="px-2.5 pb-1 text-xs font-medium text-subtle">{{ group.group }}</h3>
        <TransitionGroup tag="ul" name="list" class="relative flex flex-col gap-0.5">
          <li v-for="c in group.items" :key="c.id" class="group relative">
            <!-- Same selection language as the rail: raised row, left bloom, gutter capsule. -->
            <span
              v-if="c.id === chat.conversationId"
              aria-hidden="true"
              class="absolute -left-3 bottom-2 top-2 w-[3px] rounded-full bg-accent shadow-[0_0_10px_1px_rgb(var(--accent)/0.75)]"
            />
            <button
              type="button"
              :disabled="chat.busy && c.id !== chat.conversationId"
              :aria-current="c.id === chat.conversationId ? 'page' : undefined"
              :class="
                cn(
                  'flex h-row w-full items-center rounded-control pl-2.5 pr-8 text-left text-base transition-[background-color,color] duration-150 disabled:opacity-45',
                  c.id === chat.conversationId
                    ? 'bg-[radial-gradient(120%_140%_at_0%_50%,rgb(var(--accent)/0.12),transparent_60%),rgb(var(--raised)/0.9)] font-medium text-fg shadow-lift ring-1 ring-inset ring-line-strong/60'
                    : 'text-muted hover:bg-fg/[0.045] hover:text-fg',
                )
              "
              @click="open(c)"
            >
              <span class="truncate">{{ titleOf(c) }}</span>
            </button>
            <button
              type="button"
              :aria-label="`Delete “${titleOf(c)}”`"
              title="Delete"
              class="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-control text-subtle opacity-0 transition-opacity hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
              @click="deleteTarget = c"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </li>
        </TransitionGroup>
      </section>
      <p v-if="conversations?.length === 0" class="px-2.5 pt-4 text-sm text-muted">Your chats are saved here, on this Mac.</p>
      <p v-else-if="filter && visible.length === 0" class="px-2.5 pt-4 text-sm text-muted">No chat titles match.</p>
    </nav>

    <ConfirmDialog
      v-if="deleteTarget"
      title="Delete this chat?"
      confirm-label="Delete chat"
      :busy="deleting"
      @cancel="deleteTarget = null"
      @confirm="confirmDelete"
    >
      <template #blast>“{{ titleOf(deleteTarget) }}” and every message in it are removed from this Mac for good.</template>
    </ConfirmDialog>
  </aside>
</template>
