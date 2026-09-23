<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { Code2, MessageSquare, Play, RefreshCw, ScrollText, Square, Trash2 } from "lucide-vue-next";
import { useModels } from "@/lib/api/queries";
import { jobForRepo, useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import { useUI } from "@/stores/ui";
import { useToasts } from "@/stores/toast";
import { useCoreState } from "@/composables/useCoreState";
import ModelCore from "@/components/instruments/ModelCore.vue";
import ConnectDialog from "@/components/models/ConnectDialog.vue";
import ModelLogsDialog from "@/components/models/ModelLogsDialog.vue";
import ModelFacts from "@/components/models/ModelFacts.vue";
import { useModelAction } from "@/components/models/useModelActions";
import Badge from "@/components/ui/Badge.vue";
import Button from "@/components/ui/Button.vue";
import Callout from "@/components/ui/Callout.vue";
import Card from "@/components/ui/Card.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import { bytes, percent } from "@/lib/format";
import type { DownloadJob, Model } from "@/types";

const router = useRouter();
const { data: models, isLoading } = useModels();
const live = useLive();
const chat = useChat();
const ui = useUI();
const toasts = useToasts();
const { stateOf, toneOf } = useCoreState();
const { mutate: stopModel, isPending: stopping, variables: stopVariables } = useModelAction("stop");
const { mutate: updateModel, isPending: updating, variables: updateVariables } = useModelAction("update");
const {
  mutate: deleteModel,
  isPending: deleting,
  isError: deleteFailed,
  error: deleteError,
  reset: resetDelete,
} = useModelAction("delete", { inlineErrors: true });

const connectTarget = ref<Model | null>(null);
const deleteTarget = ref<Model | null>(null);
const logsTarget = ref<Model | null>(null);

const byName = (a: Model, b: Model) => a.display_name.localeCompare(b.display_name);
const running = computed(() => (models.value ?? []).filter((m) => m.status === "running").sort(byName));
const installed = computed(() => (models.value ?? []).filter((m) => m.status !== "running").sort(byName));
const totalOnDisk = computed(() => (models.value ?? []).reduce((sum, m) => sum + (m.download_bytes ?? 0), 0));
const groups = computed(() =>
  [
    { id: "running", title: "Running", items: running.value },
    { id: "installed", title: running.value.length ? "Installed" : "", items: installed.value },
  ].filter((g) => g.items.length > 0),
);

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
  const target = deleteTarget.value;
  if (!target) return;
  deleteModel(target.id, {
    onSuccess: () => {
      deleteTarget.value = null;
      toasts.notify(`Deleted ${target.display_name}`, { detail: `${bytes(target.download_bytes)} freed on disk.` });
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
      <template v-if="(models?.length ?? 0) > 0" #eyebrow>
        <span class="tabular">
          {{ models?.length }} installed · {{ running.length }} running · {{ bytes(totalOnDisk) }} on disk
        </span>
      </template>
      <Button variant="secondary" @click="router.push('/catalog')">Get more models</Button>
    </PageHeader>

    <EmptyState v-if="!isLoading && (models?.length ?? 0) === 0" title="No models installed">
      Models you download from the catalog land here, ready to start.
      <template #action>
        <Button @click="router.push('/catalog')">Browse the catalog</Button>
      </template>
    </EmptyState>

    <Card v-if="isLoading" class="flex flex-col gap-2 p-3">
      <Skeleton v-for="i in 4" :key="i" variant="row" class="!h-[60px]" />
    </Card>

    <div class="flex flex-col gap-8">
      <section v-for="group in groups" :key="group.id" :aria-label="group.title || 'Installed'">
        <h2 v-if="group.title" class="flex items-baseline gap-2 pb-3 text-lg font-semibold">
          {{ group.title }}
          <span class="tabular text-sm font-normal text-subtle">{{ group.items.length }}</span>
        </h2>
        <Card :lit="group.id === 'running'" class="overflow-hidden">
          <TransitionGroup tag="ul" name="list" class="relative divide-y divide-line">
            <li
              v-for="m in group.items"
              :key="m.id"
              class="group flex items-center gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-fg/[0.025]"
            >
              <ModelCore :state="stateOf(m)" :tone="toneOf(m)" :size="30" />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="truncate text-md font-semibold">{{ m.display_name }}</p>
                  <Badge v-if="m.chat_capable === false" tone="warn" title="Not a text-generation model, so chat and the API can't use it">
                    Not a chat model
                  </Badge>
                  <Badge v-if="isUpdating(m)" tone="accent" dot>
                    Updating {{ percent(jobFor(m)!.downloaded_bytes, jobFor(m)!.total_bytes || 1) }}%
                  </Badge>
                </div>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted">
                  <span class="selectable truncate font-mono text-xs text-subtle">{{ m.hf_repo_id }}</span>
                  <ModelFacts :model="m" />
                  <span class="tabular">{{ bytes(m.download_bytes) }}</span>
                </div>
              </div>

              <!-- Secondary tools stay out of the way until the row is pointed at
                   (or reached by keyboard), so a list of ten models is a list of
                   ten names, not fifty icons. -->
              <div
                class="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100"
              >
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
                <Button
                  variant="danger-quiet"
                  size="icon"
                  title="Delete"
                  :aria-label="`Delete ${m.display_name}`"
                  @click="deleteTarget = m"
                >
                  <Trash2 />
                </Button>
              </div>

              <div class="flex w-[10.5rem] items-center justify-end gap-1.5">
                <template v-if="m.chat_capable !== false && m.status === 'running'">
                  <Button size="sm" @click="openChat(m)">
                    <MessageSquare />
                    Chat
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    :loading="stopping && stopVariables === m.id"
                    @click="stopModel(m.id)"
                  >
                    <Square v-if="!(stopping && stopVariables === m.id)" class="!h-3 !w-3 fill-current" />
                    Stop
                  </Button>
                </template>
                <Button
                  v-if="m.chat_capable !== false && m.status !== 'running'"
                  variant="secondary"
                  size="sm"
                  @click="ui.requestStart(m)"
                >
                  <Play class="!h-3 !w-3 fill-current" />
                  Start
                </Button>
              </div>
            </li>
          </TransitionGroup>
        </Card>
      </section>
    </div>

    <ConnectDialog v-if="connectTarget" :model="connectTarget" @close="connectTarget = null" />
    <ModelLogsDialog v-if="logsTarget" :model="logsTarget" @close="logsTarget = null" />
    <ConfirmDialog
      v-if="deleteTarget"
      :title="`Delete ${deleteTarget.display_name}?`"
      confirm-label="Delete model"
      :busy="deleting"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    >
      You can download it again from the catalog at any time.
      <template #blast>
        Removes <span class="tabular font-semibold">{{ bytes(deleteTarget.download_bytes) }}</span> of weights for
        <span class="font-mono text-xs">{{ deleteTarget.hf_repo_id }}</span> from this Mac{{
          deleteTarget.status === "running" ? ", and unloads it from memory first" : ""
        }}.
      </template>
      <Callout v-if="deleteFailed" class="mt-3">{{ deleteError?.message }}</Callout>
    </ConfirmDialog>
  </div>
</template>
