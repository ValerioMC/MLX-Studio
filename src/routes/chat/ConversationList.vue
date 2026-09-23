<script setup lang="ts">
import { ref, computed } from "vue";
import { Plus, Trash2 } from "lucide-vue-next";
import { useConversations } from "@/lib/api/queries";
import { groupByDate, parseServerDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useChat } from "@/stores/chat";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Button from "@/components/ui/Button.vue";
import Kbd from "@/components/ui/Kbd.vue";
import type { Conversation } from "@/types";
import { deleteConversation, openConversation } from "./useChatSession";

const { data: conversations } = useConversations();
const chat = useChat();
const deleteTarget = ref<Conversation | null>(null);
const deleting = ref(false);

const groups = computed(() => groupByDate(conversations.value ?? [], (c) => parseServerDate(c.updated_at)));

function confirmDelete(): void {
  if (!deleteTarget.value) return;
  deleting.value = true;
  deleteConversation(deleteTarget.value.id)
    .catch(() => undefined)
    .finally(() => {
      deleting.value = false;
      deleteTarget.value = null;
    });
}
</script>

<template>
  <aside aria-label="Conversations" class="flex w-[15rem] shrink-0 flex-col border-r">
    <div class="flex h-10 shrink-0 items-center px-3">
      <Button variant="secondary" class="w-full justify-between" :disabled="chat.busy" @click="chat.reset()">
        <span class="inline-flex items-center gap-2">
          <Plus />
          New chat
        </span>
        <Kbd>⌘N</Kbd>
      </Button>
    </div>

    <nav class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
      <section v-for="group in groups" :key="group.group" class="pt-3">
        <h3 class="px-2 pb-1 text-xs font-medium text-muted-foreground">{{ group.group }}</h3>
        <ul class="flex flex-col gap-px">
          <li v-for="c in group.items" :key="c.id" class="group relative">
            <!-- Same selection language as the sidebar nav: a glowing capsule in
                 the gutter rather than a flat fill. -->
            <span
              v-if="c.id === chat.conversationId"
              aria-hidden="true"
              class="absolute -left-2 bottom-1 top-1 w-[3px] rounded-full bg-accent shadow-[0_0_7px_rgb(var(--accent)/0.85)]"
            />
            <button
              type="button"
              :disabled="chat.busy && c.id !== chat.conversationId"
              :aria-current="c.id === chat.conversationId ? 'page' : undefined"
              :class="
                cn(
                  'flex h-7 w-full items-center rounded-md pl-2 pr-7 text-left text-base transition-colors disabled:opacity-50',
                  c.id === chat.conversationId
                    ? 'bg-accent/[0.1] text-foreground'
                    : 'text-foreground/80 hover:bg-foreground/[0.04]',
                )
              "
              @click="openConversation(c).catch(() => undefined)"
            >
              <span class="truncate">{{ c.title || "Untitled chat" }}</span>
            </button>
            <button
              type="button"
              :aria-label="`Delete “${c.title || 'Untitled chat'}”`"
              title="Delete"
              class="absolute right-1 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-destructive/12 hover:text-destructive focus-visible:flex group-hover:flex"
              @click="deleteTarget = c"
            >
              <Trash2 class="h-3 w-3" />
            </button>
          </li>
        </ul>
      </section>
      <p v-if="conversations?.length === 0" class="px-2 pt-3 text-sm text-muted-foreground">
        Your chats are saved here, on this Mac.
      </p>
    </nav>

    <ConfirmDialog
      v-if="deleteTarget"
      title="Delete this chat?"
      confirm-label="Delete"
      :busy="deleting"
      @cancel="deleteTarget = null"
      @confirm="confirmDelete"
    >
      “{{ deleteTarget.title || "Untitled chat" }}” and all its messages will be removed.
    </ConfirmDialog>
  </aside>
</template>
