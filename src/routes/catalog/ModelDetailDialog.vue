<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { ExternalLink, Heart } from "lucide-vue-next";
import { api } from "@/lib/api/client";
import { bytes, compactNumber } from "@/lib/format";
import { openExternal } from "@/lib/openExternal";
import ModelFacts from "@/components/models/ModelFacts.vue";
import Dialog from "@/components/ui/Dialog.vue";
import Tag from "@/components/ui/Tag.vue";
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
  <Dialog :title="model.display_name" panel-class="h-[80vh] w-[48rem]" @close="$emit('close')">
    <template #description>
      <span class="selectable font-mono text-xs">{{ model.hf_repo_id }}</span>
    </template>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 pb-4 text-sm text-muted-foreground">
      <ModelFacts :model="model" />
      <span class="tabular">Needs about {{ bytes(model.est_ram_bytes) }}</span>
      <span v-if="data" class="tabular">{{ compactNumber(data.downloads) }} downloads</span>
      <span v-if="data" class="tabular inline-flex items-center gap-1">
        <Heart class="h-3 w-3" aria-hidden="true" />
        {{ compactNumber(data.likes) }}
      </span>
      <Tag v-if="data?.license">License: {{ data.license }}</Tag>
    </div>

    <div class="selectable border-t pt-4">
      <div v-if="isLoading" class="space-y-2">
        <Skeleton v-for="w in [88, 72, 94, 60]" :key="w" :style="{ width: `${w}%` }" />
      </div>
      <p v-else-if="isError" class="text-sm text-muted-foreground">
        Could not load the model card from Hugging Face.
      </p>
      <template v-else-if="data">
        <Suspense v-if="data.readme">
          <Markdown :content="cardBody(data.readme)" />
          <template #fallback>
            <div class="space-y-2">
              <Skeleton v-for="w in [88, 72, 94, 60]" :key="w" :style="{ width: `${w}%` }" />
            </div>
          </template>
        </Suspense>
        <p v-else class="text-sm text-muted-foreground">This model has no model card.</p>
      </template>
    </div>

    <template #footer>
      <button
        type="button"
        class="mr-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        @click="openExternal(`https://huggingface.co/${model.hf_repo_id}`)"
      >
        <ExternalLink class="h-3.5 w-3.5" />
        Open on Hugging Face
      </button>
      <DownloadButton :repo-id="model.hf_repo_id" />
    </template>
  </Dialog>
</template>
