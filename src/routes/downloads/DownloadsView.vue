<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { Pause, Play, RotateCw, X } from "lucide-vue-next";
import { api } from "@/lib/api/client";
import { bytes, eta, percent, speed } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useLive } from "@/stores/live";
import { useStartDownload } from "@/routes/catalog/useStartDownload";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import Button from "@/components/ui/Button.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import StatusDot from "@/components/ui/StatusDot.vue";
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
  downloading: "bg-accent",
  queued: "bg-accent",
  paused: "bg-muted-foreground",
  failed: "bg-destructive",
  completed: "bg-positive",
  canceled: "bg-muted-foreground",
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
function statusDotTone(job: DownloadJob): "danger" | "positive" | "idle" | "accent" {
  if (job.status === "failed") return "danger";
  if (job.status === "completed") return "positive";
  if (job.status === "paused") return "idle";
  return "accent";
}
</script>

<template>
  <div>
    <PageHeader title="Downloads">
      <Button v-if="finished.length > 0" variant="ghost" size="sm" @click="finished.forEach((j) => dismiss(j.id))">
        Clear finished
      </Button>
    </PageHeader>

    <EmptyState v-if="jobs.length === 0" title="No downloads">
      Downloads resume where they stopped if you pause them or quit the app mid-file.
      <template #action>
        <Button @click="router.push('/catalog')">Browse the catalog</Button>
      </template>
    </EmptyState>

    <ul v-else class="divide-y border-y">
      <li
        v-for="job in jobs"
        :key="job.id"
        class="-mx-2 flex flex-col gap-2.5 rounded-md px-2 py-4 transition-colors hover:bg-foreground/[0.03]"
      >
        <div class="flex items-center gap-3">
          <StatusDot :tone="statusDotTone(job)" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-md font-medium">{{ repoName(job.hf_repo_id) }}</p>
            <p class="selectable truncate font-mono text-xs text-muted-foreground">{{ job.hf_repo_id }}</p>
          </div>
          <div class="flex items-center gap-1">
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
              variant="ghost"
              size="icon"
              aria-label="Resume"
              title="Resume"
              @click="control(job.id, 'resume')"
            >
              <Play />
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
            <Button v-if="job.status === 'completed'" variant="secondary" size="sm" @click="router.push('/models')">
              <Play />
              Start
            </Button>
            <Button
              variant="ghost"
              size="icon"
              :aria-label="job.status === 'completed' || job.status === 'failed' ? 'Remove from list' : 'Cancel download'"
              :title="job.status === 'completed' || job.status === 'failed' ? 'Remove from list' : 'Cancel'"
              @click="job.status === 'completed' || job.status === 'failed' ? dismiss(job.id) : (cancelTarget = job)"
            >
              <X />
            </Button>
          </div>
        </div>
        <div class="pl-[19px]">
          <div class="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              :class="cn('h-full rounded-full transition-[width] duration-500 ease-out', BAR_COLOR[job.status])"
              :style="{ width: `${done(job)}%` }"
            />
          </div>
          <div class="flex justify-between gap-4 pt-1.5 text-sm">
            <span :class="cn('min-w-0 truncate', job.status === 'failed' ? 'text-destructive' : 'text-muted-foreground')">
              {{ statusLine(job) }}
            </span>
            <span class="tabular shrink-0 text-muted-foreground">
              {{
                job.total_bytes ? `${bytes(job.downloaded_bytes)} of ${bytes(job.total_bytes)}` : bytes(job.downloaded_bytes)
              }}
            </span>
          </div>
        </div>
      </li>
    </ul>

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
      The {{ bytes(cancelTarget.downloaded_bytes) }} downloaded so far will be deleted. Pause instead to finish it
      later.
    </ConfirmDialog>
  </div>
</template>
