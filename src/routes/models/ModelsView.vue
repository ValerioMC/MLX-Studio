<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Code2, MessageSquare, Play, RefreshCw, ScrollText, Square, Trash2 } from "lucide-vue-next";
import { useModels } from "@/lib/api/queries";
import { jobForRepo, useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import StartModelDialog from "@/components/models/StartModelDialog.vue";
import ConnectDialog from "@/components/models/ConnectDialog.vue";
import ModelLogsDialog from "@/components/models/ModelLogsDialog.vue";
import ModelFacts from "@/components/models/ModelFacts.vue";
import { useModelAction } from "@/components/models/useModelActions";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Button from "@/components/ui/Button.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import InlineError from "@/components/ui/InlineError.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StatusDot from "@/components/ui/StatusDot.vue";
import Tag from "@/components/ui/Tag.vue";
import { bytes, percent } from "@/lib/format";
import type { DownloadJob, Model } from "@/types";

function byStatusThenName(a: Model, b: Model): number {
  const running = Number(b.status === "running") - Number(a.status === "running");
  return running || a.display_name.localeCompare(b.display_name);
}

const router = useRouter();
const { data: models, isLoading } = useModels();
const live = useLive();
const chat = useChat();
const { mutate: stopModel, isPending: stopping, variables: stopVariables, error: stopError } = useModelAction("stop");
const {
  mutate: updateModel,
  isPending: updating,
  variables: updateVariables,
  error: updateErrorObj,
} = useModelAction("update");
const {
  mutate: deleteModel,
  isPending: deleting,
  isError: deleteFailed,
  error: deleteError,
  reset: resetDelete,
} = useModelAction("delete");

const startTarget = ref<Model | null>(null);
const connectTarget = ref<Model | null>(null);
const deleteTarget = ref<Model | null>(null);
const logsTarget = ref<Model | null>(null);

const sorted = computed(() => [...(models.value ?? [])].sort(byStatusThenName));
const totalOnDisk = computed(() => sorted.value.reduce((sum, m) => sum + (m.download_bytes ?? 0), 0));
const actionError = computed(() => stopError.value ?? updateErrorObj.value);

function openChat(model: Model): void {
  chat.model = model.id;
  void router.push("/chat");
}

function jobFor(m: Model): DownloadJob | undefined {
  return jobForRepo(live.downloads, m.hf_repo_id);
}
function isUpdating(m: Model): boolean {
  const job = jobFor(m);
  return !!job && job.status !== "failed";
}

function confirmDelete(): void {
  if (!deleteTarget.value) return;
  deleteModel(deleteTarget.value.id, {
    onSuccess: () => {
      deleteTarget.value = null;
    },
  });
}
function cancelDelete(): void {
  resetDelete();
  deleteTarget.value = null;
}
</script>

<template>
  <div>
    <PageHeader title="Models">
      <span v-if="sorted.length > 0" class="text-sm text-muted-foreground">
        {{ sorted.length }} installed, <span class="tabular">{{ bytes(totalOnDisk) }}</span> on disk
      </span>
    </PageHeader>

    <InlineError v-if="actionError" class="mb-4">{{ actionError.message }}</InlineError>

    <EmptyState v-if="!isLoading && sorted.length === 0" title="No models installed">
      Models you download from the catalog land here, ready to start.
      <template #action>
        <Button @click="router.push('/catalog')">Browse the catalog</Button>
      </template>
    </EmptyState>

    <ul v-if="sorted.length > 0" class="divide-y border-y">
      <li v-for="m in sorted" :key="m.id" class="flex items-center gap-4 py-3.5">
        <StatusDot :tone="m.status === 'running' ? 'positive' : 'idle'" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="truncate text-md font-medium">{{ m.display_name }}</p>
            <Tag
              v-if="m.chat_capable === false"
              tone="caution"
              title="Not a text-generation model, so chat and the API can't use it"
            >
              Not a chat model
            </Tag>
          </div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted-foreground">
            <span class="selectable truncate font-mono text-xs">{{ m.hf_repo_id }}</span>
            <ModelFacts :model="m" />
            <span class="tabular">{{ bytes(m.download_bytes) }}</span>
            <span v-if="isUpdating(m)" class="tabular text-accent">
              Updating {{ percent(jobFor(m)!.downloaded_bytes, jobFor(m)!.total_bytes || 1) }}%
            </span>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <template v-if="m.chat_capable !== false && m.status === 'running'">
            <Button size="sm" @click="openChat(m)">
              <MessageSquare />
              Chat
            </Button>
            <Button variant="secondary" size="sm" :loading="stopping && stopVariables === m.id" @click="stopModel(m.id)">
              <Square v-if="!(stopping && stopVariables === m.id)" class="fill-current" />
              Stop
            </Button>
          </template>
          <Button
            v-if="m.chat_capable !== false && m.status !== 'running'"
            variant="secondary"
            size="sm"
            @click="startTarget = m"
          >
            <Play />
            Start
          </Button>
          <Button
            v-if="m.chat_capable !== false"
            variant="ghost"
            size="icon"
            title="Use from code"
            :aria-label="`Use ${m.display_name} from code`"
            @click="connectTarget = m"
          >
            <Code2 />
          </Button>
          <Button variant="ghost" size="icon" title="Logs" :aria-label="`${m.display_name} logs`" @click="logsTarget = m">
            <ScrollText />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            :title="isUpdating(m) ? 'Updating' : 'Check for updates'"
            :aria-label="`Check ${m.display_name} for updates`"
            :disabled="isUpdating(m)"
            :loading="updating && updateVariables === m.id"
            @click="updateModel(m.id)"
          >
            <RefreshCw v-if="!(updating && updateVariables === m.id)" />
          </Button>
          <Button variant="danger-quiet" size="icon" title="Delete" :aria-label="`Delete ${m.display_name}`" @click="deleteTarget = m">
            <Trash2 />
          </Button>
        </div>
      </li>
    </ul>

    <StartModelDialog
      v-if="startTarget"
      :model="startTarget"
      @close="startTarget = null"
      @started="
        (m) => {
          startTarget = null;
          connectTarget = m;
        }
      "
    />
    <ConnectDialog v-if="connectTarget" :model="connectTarget" @close="connectTarget = null" />
    <ModelLogsDialog v-if="logsTarget" :model="logsTarget" @close="logsTarget = null" />
    <ConfirmDialog
      v-if="deleteTarget"
      :title="`Delete ${deleteTarget.display_name}?`"
      confirm-label="Delete"
      :busy="deleting"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    >
      <p>
        This removes
        <span class="tabular font-medium text-foreground">{{ bytes(deleteTarget.download_bytes) }}</span>
        of weights from disk. You can download it again from the catalog.
      </p>
      <InlineError v-if="deleteFailed" class="mt-3">{{ deleteError?.message }}</InlineError>
    </ConfirmDialog>
  </div>
</template>
