<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
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

/** Prism grammar for each snippet tab. */
const TAB_LANGUAGE: Record<SnippetLang, string> = {
  openai: "python",
  langchain: "python",
  java: "java",
  rust: "rust",
  curl: "bash",
};

const props = defineProps<{ model: Model }>();
defineEmits<{ close: [] }>();

// Remember the last language across dialogs: whoever integrates with
// LangChain wants the LangChain tab every time.
const tab = ref<SnippetLang>(initialTab());
const cfg = getConfig();
const apiBase = `${baseUrl()}/v1`;
const credentials = computed(() => [
  { label: "Base URL", value: apiBase },
  { label: "API key", value: cfg.apiKey },
  { label: "Model", value: props.model.id },
]);
const snippet = computed(() => buildSnippet(tab.value, apiBase, cfg.apiKey, props.model.id));

// Prism loads with the dialog, not with Overview: plain text until it arrives.
type Highlight = (code: string, language: string) => string;
const highlighter = ref<Highlight | null>(null);
onMounted(async () => {
  highlighter.value = (await import("@/components/chat/highlighter")).highlight;
});
const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const snippetHtml = computed(() =>
  highlighter.value ? highlighter.value(snippet.value, TAB_LANGUAGE[tab.value]) : escaped(snippet.value),
);

// The underline slides to the selected tab, measured from the tab itself.
const tabRefs = ref<HTMLButtonElement[]>([]);
const underline = ref({ left: 0, width: 0 });
async function placeUnderline(): Promise<void> {
  await nextTick();
  const el = tabRefs.value[SNIPPET_TABS.findIndex((t) => t.id === tab.value)];
  if (el) underline.value = { left: el.offsetLeft, width: el.offsetWidth };
}
onMounted(placeUnderline);
watch(tab, placeUnderline);

function selectTab(next: SnippetLang): void {
  tab.value = next;
  rememberTab(next);
}
</script>

<template>
  <Dialog :title="`Use ${model.display_name} from code`" panel-class="w-[44rem]" @close="$emit('close')">
    <template #description>
      {{
        model.status === "running"
          ? "It is running and answers on an OpenAI-compatible API on this Mac."
          : "It answers on an OpenAI-compatible API on this Mac, and loads on the first request."
      }}
    </template>

    <dl class="mb-5 divide-y divide-line overflow-hidden rounded-card border border-line bg-canvas/40">
      <div
        v-for="row in credentials"
        :key="row.label"
        class="grid h-row grid-cols-[6rem_1fr_auto] items-center gap-3 pl-3.5 pr-1.5"
      >
        <dt class="text-sm text-muted">{{ row.label }}</dt>
        <dd class="selectable truncate font-mono text-sm text-fg">{{ row.value }}</dd>
        <CopyButton :text="row.value" :label="`Copy ${row.label.toLowerCase()}`" />
      </div>
    </dl>

    <div role="tablist" aria-label="Language" class="relative flex gap-5 border-b border-line">
      <button
        v-for="t in SNIPPET_TABS"
        :key="t.id"
        ref="tabRefs"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        :class="cn('pb-2.5 pt-1 text-sm font-medium transition-colors', tab === t.id ? 'text-fg' : 'text-muted hover:text-fg')"
        @click="selectTab(t.id)"
      >
        {{ t.label }}
      </button>
      <!-- One underline that slides between tabs, lit like the nav capsule. -->
      <span
        aria-hidden="true"
        class="absolute -bottom-px h-[2px] rounded-full bg-accent shadow-[0_0_8px_rgb(var(--accent)/0.7)] transition-all duration-300 ease-out"
        :style="{ left: `${underline.left}px`, width: `${underline.width}px` }"
      />
    </div>
    <div role="tabpanel" class="relative mt-3">
      <!-- eslint-disable vue/no-v-html -- Prism output over a snippet built from our own config, not user markup. -->
      <Transition name="crossfade" mode="out-in">
        <pre
          :key="tab"
          class="selectable max-h-[18rem] overflow-auto rounded-card border border-line bg-canvas/60 p-4 font-mono text-[12px] leading-relaxed"
        ><code v-html="snippetHtml" /></pre>
      </Transition>
      <!-- eslint-enable vue/no-v-html -->
      <CopyButton :text="snippet" label="Copy code" show-label class="absolute right-2.5 top-2.5 bg-raised shadow-lift ring-1 ring-inset ring-line" />
    </div>
  </Dialog>
</template>
