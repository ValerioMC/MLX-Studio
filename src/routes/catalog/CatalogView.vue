<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { Search, X } from "lucide-vue-next";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { compactNumber } from "@/lib/format";
import ModelFacts from "@/components/models/ModelFacts.vue";
import Button from "@/components/ui/Button.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import InlineError from "@/components/ui/InlineError.vue";
import Kbd from "@/components/ui/Kbd.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import { fieldClass } from "@/components/ui/field";
import Chip from "./Chip.vue";
import FitMeter from "./FitMeter.vue";
import ModelDetailDialog from "./ModelDetailDialog.vue";
import DownloadButton from "./DownloadButton.vue";
import type { CatalogModel, CatalogSort } from "@/types";

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 300;

interface CatalogPage {
  items: CatalogModel[];
  budget_bytes: number;
  total_usable_bytes: number;
}

type Quant = "4bit" | "8bit";

interface Filters {
  quant: Quant | null;
  vision: boolean;
  instruct: boolean;
  fitsOnly: boolean;
}

const SORT_OPTIONS: readonly { value: CatalogSort; label: string }[] = [
  { value: "downloads", label: "Most downloaded" },
  { value: "likes", label: "Most liked" },
  { value: "recent", label: "Recently updated" },
];

const query = ref("");
const debouncedQuery = ref("");
const sort = ref<CatalogSort>("downloads");
const filters = ref<Filters>({ quant: null, vision: false, instruct: false, fitsOnly: false });
// Paging belongs to one question: a new search or filter starts from the first page.
const page = ref({ question: "", limit: PAGE_SIZE });
const detailTarget = ref<CatalogModel | null>(null);
const searchRef = ref<HTMLInputElement | null>(null);

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
watch(query, (value) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = value.trim();
  }, SEARCH_DEBOUNCE_MS);
});

function onGlobalKey(event: KeyboardEvent): void {
  if (event.metaKey && event.key === "f") {
    event.preventDefault();
    searchRef.value?.focus();
    searchRef.value?.select();
  }
}
onMounted(() => window.addEventListener("keydown", onGlobalKey));
onUnmounted(() => window.removeEventListener("keydown", onGlobalKey));

const question = computed(() =>
  JSON.stringify([
    debouncedQuery.value,
    sort.value,
    filters.value.quant,
    filters.value.vision,
    filters.value.instruct,
  ]),
);
const limit = computed(() => (page.value.question === question.value ? page.value.limit : PAGE_SIZE));

const { data, isFetching, isError, error, refetch, isPlaceholderData } = useQuery({
  queryKey: computed(() => [
    "catalog",
    debouncedQuery.value,
    sort.value,
    filters.value.quant,
    filters.value.vision,
    filters.value.instruct,
    limit.value,
  ]),
  queryFn: () => {
    const p = new URLSearchParams({ limit: String(limit.value), sort: sort.value });
    if (debouncedQuery.value) p.set("q", debouncedQuery.value);
    if (filters.value.quant) p.set("quant", filters.value.quant);
    if (filters.value.vision) p.set("vision", "true");
    if (filters.value.instruct) p.set("instruct", "true");
    return api<CatalogPage>(`/catalog/search?${p}`);
  },
  placeholderData: keepPreviousData,
  staleTime: 60_000,
});

const items = computed(() => (data.value?.items ?? []).filter((m) => !filters.value.fitsOnly || m.fit === "fits"));
function toggle(patch: Partial<Filters>): void {
  filters.value = { ...filters.value, ...patch };
}
const mayHaveMore = computed(() => (data.value?.items.length ?? 0) >= limit.value);
</script>

<template>
  <div>
    <PageHeader title="Catalog">
      <span class="text-sm text-muted-foreground">MLX conversions from Hugging Face</span>
    </PageHeader>

    <div class="glass sticky top-0 z-sticky -mx-2 flex flex-col gap-2.5 px-2 pb-3">
      <div class="relative">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref="searchRef"
          v-model="query"
          placeholder="Search models, like qwen, llama or gemma"
          aria-label="Search models"
          :class="cn(fieldClass, 'h-9 pl-8 pr-16')"
          @keydown.esc="query = ''"
        />
        <div class="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <Button v-if="query" variant="ghost" size="icon-sm" aria-label="Clear search" @click="query = ''">
            <X />
          </Button>
          <Kbd v-else>⌘F</Kbd>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-1">
        <Chip label="4-bit" :active="filters.quant === '4bit'" @click="toggle({ quant: filters.quant === '4bit' ? null : '4bit' })" />
        <Chip label="8-bit" :active="filters.quant === '8bit'" @click="toggle({ quant: filters.quant === '8bit' ? null : '8bit' })" />
        <Chip label="Vision" :active="filters.vision" @click="toggle({ vision: !filters.vision })" />
        <Chip label="Instruct" :active="filters.instruct" @click="toggle({ instruct: !filters.instruct })" />
        <span aria-hidden="true" class="mx-1.5 h-4 w-px bg-border" />
        <Chip label="Fits this Mac" :active="filters.fitsOnly" @click="toggle({ fitsOnly: !filters.fitsOnly })" />
        <label class="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          Sort
          <select v-model="sort" :class="cn(fieldClass, 'h-7 w-auto pr-7 text-sm')">
            <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </label>
      </div>
    </div>

    <InlineError v-if="isError" class="mb-4 flex items-center justify-between gap-4">
      <span>Could not reach Hugging Face: {{ error?.message }}</span>
      <Button variant="secondary" size="sm" @click="refetch()">Try again</Button>
    </InlineError>

    <ul v-if="!data && isFetching" class="divide-y border-y" aria-busy="true">
      <li v-for="i in 6" :key="i" class="flex items-center gap-4 py-4">
        <div class="flex-1 space-y-2">
          <Skeleton class="w-56" />
          <Skeleton class="w-80" />
        </div>
        <Skeleton variant="block" class="h-7 w-24" />
      </li>
    </ul>

    <EmptyState
      v-else-if="items.length === 0 && data"
      :title="debouncedQuery ? `Nothing matches “${debouncedQuery}”` : 'No models match these filters'"
    >
      {{
        filters.fitsOnly
          ? "None of these fit in free memory right now. Turn off “Fits this Mac” to see models that fit once memory is reclaimed."
          : "Try a family name like qwen, llama, mistral or gemma, or clear a filter."
      }}
    </EmptyState>

    <ul v-else :class="cn('divide-y border-y transition-opacity', isPlaceholderData && 'opacity-60')">
      <li
        v-for="m in items"
        :key="m.hf_repo_id"
        class="-mx-2 flex items-center gap-5 rounded-md px-2 py-3 transition-colors hover:bg-foreground/[0.03]"
      >
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="max-w-full truncate text-left text-md font-medium hover:text-accent"
            @click="detailTarget = m"
          >
            {{ m.display_name }}
          </button>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted-foreground">
            <ModelFacts :model="m" show-instruct />
            <span class="tabular" title="Downloads in the last 30 days">{{ compactNumber(m.downloads_30d ?? 0) }} downloads</span>
            <span v-if="sort === 'likes'" class="tabular">{{ compactNumber(m.likes ?? 0) }} likes</span>
          </div>
        </div>
        <FitMeter :model="m" :usable-bytes="data?.total_usable_bytes ?? 0" />
        <div class="flex w-[9.5rem] justify-end">
          <DownloadButton :repo-id="m.hf_repo_id" quiet />
        </div>
      </li>
    </ul>

    <div v-if="mayHaveMore && items.length > 0" class="flex justify-center pt-5">
      <Button variant="secondary" :loading="isFetching" @click="page = { question, limit: limit + PAGE_SIZE }">
        Show more
      </Button>
    </div>

    <ModelDetailDialog v-if="detailTarget" :model="detailTarget" @close="detailTarget = null" />
  </div>
</template>
