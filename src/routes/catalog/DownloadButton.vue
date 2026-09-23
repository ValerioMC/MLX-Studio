<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Check, Download, RotateCw } from "lucide-vue-next";
import { useModels } from "@/lib/api/queries";
import { jobForRepo, useLive } from "@/stores/live";
import Button from "@/components/ui/Button.vue";
import { percent } from "@/lib/format";
import { useStartDownload } from "./useStartDownload";

/** Download, or where the download of this repo stands. */
const props = withDefaults(defineProps<{ repoId: string; quiet?: boolean }>(), { quiet: false });
const router = useRouter();
const { data: models } = useModels();
const live = useLive();
const job = computed(() => jobForRepo(live.downloads, props.repoId));

const { mutate: startDownload, isPending: downloading, isError: downloadFailed, error: downloadError } = useStartDownload();

const installed = computed(() => models.value?.some((m) => m.hf_repo_id === props.repoId) ?? false);
const failed = computed(() => job.value?.status === "failed" || downloadFailed.value);
</script>

<template>
  <Button
    v-if="installed"
    variant="ghost"
    size="sm"
    class="text-positive hover:text-positive"
    @click="router.push('/models')"
  >
    <Check />
    Installed
  </Button>

  <Button
    v-else-if="job && job.status !== 'failed'"
    variant="secondary"
    size="sm"
    class="tabular min-w-[6.5rem]"
    @click="router.push('/downloads')"
  >
    {{ job.status === "paused" ? "Paused" : `Downloading ${percent(job.downloaded_bytes, job.total_bytes || 1)}%` }}
  </Button>

  <Button
    v-else
    :variant="failed || quiet ? 'secondary' : 'primary'"
    size="sm"
    :loading="downloading"
    :title="downloadError?.message ?? job?.error ?? undefined"
    class="min-w-[6.5rem]"
    @click="startDownload(repoId)"
  >
    <RotateCw v-if="!downloading && failed" />
    <Download v-else-if="!downloading" />
    {{ failed ? "Retry" : "Download" }}
  </Button>
</template>
