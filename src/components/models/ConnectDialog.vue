<script setup lang="ts">
import { ref } from "vue";
import { baseUrl, getConfig } from "@/lib/api/client";
import Dialog from "@/components/ui/Dialog.vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import { cn } from "@/lib/utils";
import type { Model } from "@/types";
import { buildSnippet, SNIPPET_TABS, type SnippetLang } from "./snippets";

const TAB_STORAGE_KEY = "mlxstudio.connect.tab";

function initialTab(): SnippetLang {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return SNIPPET_TABS.find((t) => t.id === saved)?.id ?? "openai";
  } catch {
    return "openai";
  }
}

function rememberTab(tab: SnippetLang): void {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // Storage unavailable: the choice just isn't remembered.
  }
}

defineProps<{ model: Model }>();
defineEmits<{ close: [] }>();

// Remember the last language across dialogs: whoever integrates with
// LangChain wants the LangChain tab every time.
const tab = ref<SnippetLang>(initialTab());
const cfg = getConfig();
const apiBase = `${baseUrl()}/v1`;

function selectTab(next: SnippetLang): void {
  tab.value = next;
  rememberTab(next);
}
</script>

<template>
  <Dialog :title="`Use ${model.display_name} from code`" panel-class="w-[42rem]" @close="$emit('close')">
    <template #description>
      {{
        model.status === "running"
          ? "It is running and answers on an OpenAI-compatible API on this Mac."
          : "It answers on an OpenAI-compatible API on this Mac, and loads on the first request."
      }}
    </template>

    <dl class="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">
      <div class="contents">
        <dt class="text-muted-foreground">Base URL</dt>
        <dd class="selectable truncate font-mono text-xs">{{ apiBase }}</dd>
        <CopyButton :text="apiBase" label="Copy base url" />
      </div>
      <div class="contents">
        <dt class="text-muted-foreground">API key</dt>
        <dd class="selectable truncate font-mono text-xs">{{ cfg.apiKey }}</dd>
        <CopyButton :text="cfg.apiKey" label="Copy api key" />
      </div>
      <div class="contents">
        <dt class="text-muted-foreground">Model</dt>
        <dd class="selectable truncate font-mono text-xs">{{ model.id }}</dd>
        <CopyButton :text="model.id" label="Copy model" />
      </div>
    </dl>

    <div role="tablist" aria-label="Language" class="flex gap-4 border-b">
      <button
        v-for="t in SNIPPET_TABS"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        :class="
          cn(
            '-mb-px border-b-2 pb-2 pt-1 text-sm font-medium transition-colors',
            tab === t.id ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )
        "
        @click="selectTab(t.id)"
      >
        {{ t.label }}
      </button>
    </div>
    <div role="tabpanel" class="relative mt-3">
      <pre class="max-h-[18rem] overflow-auto rounded-lg bg-muted/60 p-3.5 font-mono text-xs leading-relaxed">{{
        buildSnippet(tab, apiBase, cfg.apiKey, model.id)
      }}</pre>
      <CopyButton
        :text="buildSnippet(tab, apiBase, cfg.apiKey, model.id)"
        label="Copy code"
        show-label
        class="absolute right-2 top-2 bg-card shadow-float"
      />
    </div>
  </Dialog>
</template>
