<script setup lang="ts">
import { computed, watch } from "vue";
import { useRouter } from "vue-router";
import { Check, Download, RotateCw } from "lucide-vue-next";
import { useModels } from "@/lib/api/queries";
import { jobForRepo, useLive } from "@/stores/live";
import { useToasts } from "@/stores/toast";
import Button from "@/components/ui/Button.vue";
import { percent } from "@/lib/format";
import { useStartDownload } from "./useStartDownload";

/**
 * Download, or where the download of this repo stands. While it runs, the
 * button *is* the progress: its own fill grows behind the label, with a sheen
 * travelling across it — and only while bytes are arriving.
 */
const props = withDefaults(defineProps<{ repoId: string; quiet?: boolean }>(), { quiet: false });
const router = useRouter();
const toasts = useToasts();
const { data: models } = useModels();
const live = useLive();
const job = computed(() => jobForRepo(live.downloads, props.repoId));
const progress = computed(() => (job.value ? percent(job.value.downloaded_bytes, job.value.total_bytes || 1) : 0));

const { mutate: startDownload, isPending: downloading, isError: downloadFailed, error: downloadError } = useStartDownload();

const installed = computed(() => models.value?.some((m) => m.hf_repo_id === props.repoId) ?? false);
const failed = computed(() => job.value?.status === "failed" || downloadFailed.value);

watch(downloadError, (error) => {
  if (error) toasts.notifyError(error, "Could not start the download");
});
</script>

<template>
  <Button
    v-if="installed"
    variant="ghost"
    size="sm"
    class="text-safe hover:bg-safe-soft hover:text-safe"
    @click="router.push('/models')"
  >
    <Check :stroke-width="2.5" />
    Installed
  </Button>

  <button
    v-else-if="job && job.status !== 'failed'"
    type="button"
    class="no-drag tabular relative inline-flex h-control-sm min-w-[7.5rem] items-center justify-center overflow-hidden rounded-control bg-raised px-3 text-sm font-medium text-fg shadow-lift ring-1 ring-inset ring-line"
    :title="job.status === 'paused' ? 'Paused — open Downloads' : 'Open Downloads'"
    @click="router.push('/downloads')"
  >
    <span
      aria-hidden="true"
      class="absolute inset-y-0 left-0 bg-accent-soft transition-[width] duration-500 ease-out"
      :style="{ width: `${progress}%` }"
    >
      <span
        v-if="job.status === 'downloading'"
        class="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-accent/25 to-transparent [animation:sheen_1.6s_ease-in-out_infinite]"
      />
    </span>
    <span class="relative">{{ job.status === "paused" ? `Paused ${progress}%` : `${progress}%` }}</span>
  </button>

  <Button
    v-else
    :variant="failed || quiet ? 'secondary' : 'primary'"
    size="sm"
    :loading="downloading"
    :title="downloadError?.message ?? job?.error ?? undefined"
    class="min-w-[7.5rem]"
    @click="startDownload(repoId)"
  >
    <RotateCw v-if="!downloading && failed" />
    <Download v-else-if="!downloading" />
    {{ failed ? "Retry" : "Download" }}
  </Button>
</template>
