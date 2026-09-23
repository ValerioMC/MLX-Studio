<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { Pause, Play, RotateCw, X } from "lucide-vue-next";
import { api } from "@/lib/api/client";
import { bytes, eta, percent, speed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLive } from "@/stores/live";
import { useStartDownload } from "@/routes/catalog/useStartDownload";
import ProgressRing from "@/components/instruments/ProgressRing.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import type { DownloadJob, DownloadStatus } from "@/types";

const ORDER: Record<DownloadStatus, number> = {
  downloading: 0,
  queued: 1,
  paused: 2,
  failed: 3,
  completed: 4,
  canceled: 5,
};

function repoName(repoId: string): string {
  return repoId.split("/").pop()?.replace(/-/g, " ") ?? repoId;
}

function statusLine(job: DownloadJob): string {
  const total = job.total_bytes || 0;
  switch (job.status) {
    case "queued":
      return "Waiting to start";
    case "downloading": {
      if (!total) return "Reading the file list…";
      const left = eta(total - job.downloaded_bytes, job.speed_bps);
      return [speed(job.speed_bps), left].filter((part) => part && part !== "—").join(", ") || "Starting…";
    }
    case "paused":
      return "Paused";
    case "failed":
      return job.error ?? "Download failed";
    case "completed":
      return "Installed";
    case "canceled":
      return "Canceled";
  }
}

const BAR_COLOR: Record<DownloadStatus, string> = {
  downloading: "bg-accent shadow-[0_0_10px_rgb(var(--accent)/0.6)]",
  queued: "bg-accent/40",
  paused: "bg-muted",
  failed: "bg-danger",
  completed: "bg-safe",
  canceled: "bg-muted",
};

const router = useRouter();
const live = useLive();
const { mutate: retryDownload, isPending: retrying, variables: retryVariables } = useStartDownload();
const cancelTarget = ref<DownloadJob | null>(null);

const jobs = computed(() => Object.values(live.downloads).sort((a, b) => ORDER[a.status] - ORDER[b.status]));
const finished = computed(() => jobs.value.filter((j) => j.status === "completed"));

// Dropping a finished job from the list never touches the installed model.
function dismiss(id: string): void {
  live.dropDownload(id);
  void api(`/downloads/${id}`, { method: "DELETE" }).catch(() => undefined);
}
function control(id: string, action: "pause" | "resume"): void {
  void api(`/downloads/${id}/${action}`, { method: "POST" }).catch(() => undefined);
}
function retry(job: DownloadJob): void {
  dismiss(job.id);
  retryDownload(job.hf_repo_id);
}

function done(job: DownloadJob): number {
  return job.status === "completed" ? 100 : percent(job.downloaded_bytes, job.total_bytes || 1);
}
const inFlight = computed(() => jobs.value.filter((j) => j.status === "downloading"));
const totalSpeed = computed(() => inFlight.value.reduce((sum, j) => sum + (j.speed_bps ?? 0), 0));
</script>

<template>
  <div>
    <PageHeader title="Downloads">
      <template v-if="jobs.length > 0" #eyebrow>
        <span class="tabular">
          {{ inFlight.length }} in progress{{ totalSpeed ? ` · ${speed(totalSpeed)} total` : "" }}
        </span>
      </template>
      <Button v-if="finished.length > 0" variant="ghost" @click="finished.forEach((j) => dismiss(j.id))">
        Clear finished
      </Button>
    </PageHeader>

    <EmptyState v-if="jobs.length === 0" title="No downloads">
      Downloads resume where they stopped if you pause them or quit the app mid-file.
      <template #action>
        <Button @click="router.push('/catalog')">Browse the catalog</Button>
      </template>
    </EmptyState>

    <Card v-else class="overflow-hidden">
      <TransitionGroup tag="ul" name="list" class="relative divide-y divide-line">
        <li v-for="job in jobs" :key="job.id" class="flex items-center gap-4 px-4 py-4">
          <ProgressRing :status="job.status" :percent="done(job)" :size="40" />
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-4">
              <p class="truncate text-md font-semibold capitalize">{{ repoName(job.hf_repo_id) }}</p>
              <span class="tabular shrink-0 text-sm text-muted">
                {{
                  job.total_bytes ? `${bytes(job.downloaded_bytes)} of ${bytes(job.total_bytes)}` : bytes(job.downloaded_bytes)
                }}
              </span>
            </div>
            <p class="selectable truncate font-mono text-xs text-subtle">{{ job.hf_repo_id }}</p>
            <div class="relative mt-2.5 h-1 overflow-hidden rounded-full bg-fg/[0.07]" aria-hidden="true">
              <div
                :class="cn('relative h-full overflow-hidden rounded-full transition-[width] duration-700 ease-out', BAR_COLOR[job.status])"
                :style="{ width: `${Math.max(done(job), 1)}%` }"
              >
                <!-- The sheen runs only while bytes are arriving. -->
                <span
                  v-if="job.status === 'downloading'"
                  class="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent [animation:sheen_1.8s_ease-in-out_infinite]"
                />
              </div>
            </div>
            <p :class="cn('truncate pt-1.5 text-sm', job.status === 'failed' ? 'text-danger' : 'text-muted')">
              {{ statusLine(job) }}
            </p>
          </div>

          <!-- Fixed width, so every row's progress bar ends at the same x. -->
          <div class="flex w-[9.5rem] shrink-0 items-center justify-end gap-1 self-center">
            <Button
              v-if="job.status === 'downloading'"
              variant="ghost"
              size="icon"
              aria-label="Pause"
              title="Pause"
              @click="control(job.id, 'pause')"
            >
              <Pause />
            </Button>
            <Button
              v-if="job.status === 'paused'"
              variant="secondary"
              size="sm"
              aria-label="Resume"
              @click="control(job.id, 'resume')"
            >
              <Play class="!h-3 !w-3 fill-current" />
              Resume
            </Button>
            <Button
              v-if="job.status === 'failed'"
              variant="secondary"
              size="sm"
              :loading="retrying && retryVariables === job.hf_repo_id"
              @click="retry(job)"
            >
              <RotateCw />
              Retry
            </Button>
            <Button v-if="job.status === 'completed'" size="sm" @click="router.push('/models')">
              <Play class="!h-3 !w-3 fill-current" />
              Start
            </Button>
            <Button
              :variant="job.status === 'completed' || job.status === 'failed' ? 'ghost' : 'danger-quiet'"
              size="icon"
              :aria-label="job.status === 'completed' || job.status === 'failed' ? 'Remove from list' : 'Cancel download'"
              :title="job.status === 'completed' || job.status === 'failed' ? 'Remove from list' : 'Cancel'"
              @click="job.status === 'completed' || job.status === 'failed' ? dismiss(job.id) : (cancelTarget = job)"
            >
              <X />
            </Button>
          </div>
        </li>
      </TransitionGroup>
    </Card>

    <ConfirmDialog
      v-if="cancelTarget"
      title="Cancel this download?"
      confirm-label="Cancel download"
      @cancel="cancelTarget = null"
      @confirm="
        () => {
          dismiss(cancelTarget!.id);
          cancelTarget = null;
        }
      "
    >
      Pause instead to finish it later.
      <template #blast>
        Deletes the <span class="tabular font-semibold">{{ bytes(cancelTarget.downloaded_bytes) }}</span> of
        <span class="font-mono text-xs">{{ cancelTarget.hf_repo_id }}</span> downloaded so far.
      </template>
    </ConfirmDialog>
  </div>
</template>
