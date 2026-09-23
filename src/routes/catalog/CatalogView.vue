<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { Heart, Search, TrendingUp, X } from "lucide-vue-next";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { compactNumber } from "@/lib/format";
import FitGauge from "@/components/instruments/FitGauge.vue";
import ModelFacts from "@/components/models/ModelFacts.vue";
import Button from "@/components/ui/Button.vue";
import Callout from "@/components/ui/Callout.vue";
import Card from "@/components/ui/Card.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import Kbd from "@/components/ui/Kbd.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import Select from "@/components/ui/Select.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import Spinner from "@/components/ui/Spinner.vue";
import { fieldClass } from "@/components/ui/field";
import Chip from "./Chip.vue";
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

const route = useRoute();
// The palette's "Search the catalog for …" lands here with ?q=.
const initialQuery = typeof route.query.q === "string" ? route.query.q : "";
const query = ref(initialQuery);
const debouncedQuery = ref(initialQuery.trim());
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
watch(
  () => route.query.q,
  (q) => {
    if (typeof q === "string") {
      query.value = q;
      debouncedQuery.value = q.trim();
    }
  },
);

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
  JSON.stringify([debouncedQuery.value, sort.value, filters.value.quant, filters.value.vision, filters.value.instruct]),
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
const activeFilters = computed(
  () => Number(!!filters.value.quant) + Number(filters.value.vision) + Number(filters.value.instruct) + Number(filters.value.fitsOnly),
);
function clearFilters(): void {
  filters.value = { quant: null, vision: false, instruct: false, fitsOnly: false };
}
</script>

<template>
  <div>
    <PageHeader title="Catalog" eyebrow="MLX conversions from Hugging Face, sized for this Mac" />

    <!-- Sticky glass: the search and filters stay reachable while results
         scroll underneath, still legible through the blur. -->
    <div class="glass sticky top-titlebar z-sticky mb-5 flex flex-col gap-3 rounded-card border border-line/70 p-3 shadow-lift">
      <div :class="cn(fieldClass, 'relative flex h-[42px] items-center gap-2.5 px-3.5')">
        <Search class="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
        <input
          ref="searchRef"
          v-model="query"
          placeholder="Search models, like qwen, llama or gemma"
          aria-label="Search models"
          spellcheck="false"
          class="h-full flex-1 bg-transparent text-md outline-none placeholder:text-subtle"
          @keydown.esc="query = ''"
        />
        <Spinner v-if="isFetching && data" :size="14" class="text-accent-text" />
        <Button v-if="query" variant="ghost" size="icon-sm" aria-label="Clear search" @click="query = ''">
          <X />
        </Button>
        <Kbd v-else>⌘F</Kbd>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <Chip label="4-bit" :active="filters.quant === '4bit'" @click="toggle({ quant: filters.quant === '4bit' ? null : '4bit' })" />
        <Chip label="8-bit" :active="filters.quant === '8bit'" @click="toggle({ quant: filters.quant === '8bit' ? null : '8bit' })" />
        <Chip label="Vision" :active="filters.vision" @click="toggle({ vision: !filters.vision })" />
        <Chip label="Instruct" :active="filters.instruct" @click="toggle({ instruct: !filters.instruct })" />
        <span aria-hidden="true" class="mx-1 h-4 w-px bg-line-strong" />
        <Chip label="Fits this Mac" :active="filters.fitsOnly" @click="toggle({ fitsOnly: !filters.fitsOnly })" />
        <button v-if="activeFilters > 0" type="button" class="ml-1 text-sm text-subtle hover:text-fg" @click="clearFilters">
          Clear
        </button>
        <div class="ml-auto w-[12.5rem]">
          <Select v-model="sort" :options="SORT_OPTIONS" label="Sort" size="sm" />
        </div>
      </div>
    </div>

    <Callout v-if="isError" class="mb-4">
      Could not reach Hugging Face: {{ error?.message }}
      <template #action>
        <Button variant="secondary" size="sm" @click="refetch()">Try again</Button>
      </template>
    </Callout>

    <Card v-if="!data && isFetching" class="flex flex-col gap-2 p-3" aria-busy="true">
      <Skeleton v-for="i in 6" :key="i" variant="row" class="!h-[62px]" />
    </Card>

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

    <Card v-else-if="data" :class="cn('overflow-hidden transition-opacity duration-200', isPlaceholderData && 'opacity-55')">
      <ul class="divide-y divide-line">
        <li
          v-for="m in items"
          :key="m.hf_repo_id"
          class="group flex items-center gap-6 px-4 py-3.5 transition-colors duration-150 hover:bg-fg/[0.025]"
        >
          <div class="min-w-0 flex-1">
            <button
              type="button"
              class="max-w-full truncate text-left text-md font-semibold transition-colors group-hover:text-accent-text"
              @click="detailTarget = m"
            >
              {{ m.display_name }}
            </button>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted">
              <ModelFacts :model="m" show-instruct />
              <span class="tabular inline-flex items-center gap-1" title="Downloads in the last 30 days">
                <TrendingUp class="h-3 w-3 text-subtle" aria-hidden="true" />
                {{ compactNumber(m.downloads_30d ?? 0) }}
              </span>
              <span v-if="m.likes" class="tabular inline-flex items-center gap-1">
                <Heart class="h-3 w-3 text-subtle" aria-hidden="true" />
                {{ compactNumber(m.likes) }}
              </span>
            </div>
          </div>
          <FitGauge
            :fit="m.fit ?? 'unknown'"
            :need-bytes="m.est_ram_bytes"
            :usable-bytes="data.total_usable_bytes"
            :free-bytes="data.budget_bytes"
          />
          <div class="flex w-[8rem] justify-end">
            <DownloadButton :repo-id="m.hf_repo_id" quiet />
          </div>
        </li>
      </ul>
    </Card>

    <div v-if="mayHaveMore && items.length > 0" class="flex justify-center pt-6">
      <Button variant="secondary" :loading="isFetching" @click="page = { question, limit: limit + PAGE_SIZE }">
        Show more
      </Button>
    </div>

    <ModelDetailDialog v-if="detailTarget" :model="detailTarget" @close="detailTarget = null" />
  </div>
</template>
