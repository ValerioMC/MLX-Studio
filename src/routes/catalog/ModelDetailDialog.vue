<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { ExternalLink, Heart } from "lucide-vue-next";
import { api } from "@/lib/api/client";
import { bytes, compactNumber } from "@/lib/format";
import { openExternal } from "@/lib/openExternal";
import ModelFacts from "@/components/models/ModelFacts.vue";
import Button from "@/components/ui/Button.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Badge from "@/components/ui/Badge.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import DownloadButton from "./DownloadButton.vue";
import type { CatalogModel } from "@/types";

// The Markdown renderer and its Prism highlighter load when a model card
// first opens, not with the catalog.
const Markdown = defineAsyncComponent(() => import("@/components/chat/Markdown.vue"));

interface RepoDetail {
  hf_repo_id: string;
  license: string | null;
  downloads: number;
  likes: number;
  readme: string | null;
}

/** Strips the YAML front matter model cards start with. */
function cardBody(readme: string): string {
  return readme.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

const props = defineProps<{ model: CatalogModel }>();
defineEmits<{ close: [] }>();

const { data, isLoading, isError } = useQuery({
  queryKey: ["catalog-detail", props.model.hf_repo_id],
  queryFn: () => api<RepoDetail>(`/catalog/detail?repo_id=${encodeURIComponent(props.model.hf_repo_id)}`),
  staleTime: 5 * 60 * 1000,
});
</script>

<template>
  <Dialog :title="model.display_name" panel-class="h-[82vh] w-[50rem]" @close="$emit('close')">
    <template #description>
      <span class="selectable font-mono text-xs">{{ model.hf_repo_id }}</span>
    </template>

    <!-- Facts as a spec strip: the numbers you decide on, before the prose. -->
    <dl class="mb-5 grid grid-cols-4 divide-x divide-line overflow-hidden rounded-card border border-line bg-canvas/40">
      <div class="px-4 py-3">
        <dt class="text-xs text-muted">Needs about</dt>
        <dd class="tabular pt-0.5 text-lg font-semibold">{{ bytes(model.est_ram_bytes) }}</dd>
      </div>
      <div class="px-4 py-3">
        <dt class="text-xs text-muted">Downloads</dt>
        <dd class="tabular pt-0.5 text-lg font-semibold">{{ data ? compactNumber(data.downloads) : "—" }}</dd>
      </div>
      <div class="px-4 py-3">
        <dt class="flex items-center gap-1 text-xs text-muted"><Heart class="h-3 w-3" aria-hidden="true" /> Likes</dt>
        <dd class="tabular pt-0.5 text-lg font-semibold">{{ data ? compactNumber(data.likes) : "—" }}</dd>
      </div>
      <div class="px-4 py-3">
        <dt class="text-xs text-muted">License</dt>
        <dd class="truncate pt-0.5 text-lg font-semibold">{{ data?.license ?? "—" }}</dd>
      </div>
    </dl>
    <div class="flex flex-wrap items-center gap-2 pb-5">
      <ModelFacts :model="model" show-instruct />
      <Badge v-if="model.fit === 'fits'" tone="safe" dot>Fits this Mac</Badge>
      <Badge v-else-if="model.fit === 'tight'" tone="warn" dot>Tight on this Mac</Badge>
      <Badge v-else-if="model.fit === 'too_big'" tone="danger" dot>Too big for this Mac</Badge>
    </div>

    <div class="selectable border-t border-line pt-5">
      <div v-if="isLoading" class="space-y-2.5">
        <Skeleton v-for="w in [88, 72, 94, 60]" :key="w" :style="{ width: `${w}%` }" />
      </div>
      <p v-else-if="isError" class="text-sm text-muted">Could not load the model card from Hugging Face.</p>
      <template v-else-if="data">
        <Suspense v-if="data.readme">
          <Markdown :content="cardBody(data.readme)" />
          <template #fallback>
            <div class="space-y-2.5">
              <Skeleton v-for="w in [88, 72, 94, 60]" :key="w" :style="{ width: `${w}%` }" />
            </div>
          </template>
        </Suspense>
        <p v-else class="text-sm text-muted">This model has no model card.</p>
      </template>
    </div>

    <template #footer>
      <Button variant="ghost" size="sm" class="mr-auto" @click="openExternal(`https://huggingface.co/${model.hf_repo_id}`)">
        <ExternalLink />
        Open on Hugging Face
      </Button>
      <DownloadButton :repo-id="model.hf_repo_id" />
    </template>
  </Dialog>
</template>
