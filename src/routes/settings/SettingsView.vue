<script setup lang="ts">
import { FolderOpen } from "lucide-vue-next";
import { baseUrl, getConfig } from "@/lib/api/client";
import { useAppSettings } from "@/lib/api/queries";
import { cn } from "@/lib/utils";
import { useUI, type Theme } from "@/stores/ui";
import PageHeader from "@/components/ui/PageHeader.vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import ChatSettingsForm from "@/routes/chat/ChatSettingsForm.vue";
import Section from "./Section.vue";
import ValueRow from "./ValueRow.vue";
import HfTokenField from "./HfTokenField.vue";

/** Each theme choice is shown as a tiny window in that theme, not just a word. */
const THEMES: readonly { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const ui = useUI();
const cfg = getConfig();
const { data: settings } = useAppSettings();
</script>

<template>
  <div>
    <PageHeader title="Settings" eyebrow="Saved on this Mac and applied at once" />

    <div class="flex flex-col gap-4">
      <Section title="Appearance" description="System follows your Mac's light or dark setting.">
        <div role="radiogroup" aria-label="Theme" class="flex gap-3">
          <button
            v-for="t in THEMES"
            :key="t.value"
            type="button"
            role="radio"
            :aria-checked="ui.theme === t.value"
            class="group flex flex-col items-center gap-2"
            @click="ui.setTheme(t.value)"
          >
            <!-- A miniature window: rail, a title, two lines and a lit button.
                 The only raw hex values in the app, on purpose: each tile has
                 to show *its* theme whatever theme is active, so it cannot use
                 the tokens (which follow the active one). -->
            <span
              :class="
                cn(
                  'relative flex h-[68px] w-[104px] overflow-hidden rounded-control ring-1 transition-[box-shadow] duration-200',
                  ui.theme === t.value ? 'shadow-glow ring-accent' : 'ring-line-strong group-hover:ring-subtle',
                )
              "
            >
              <span v-if="t.value !== 'light'" class="absolute inset-0 flex bg-[#07080b]" :class="t.value === 'system' && '[clip-path:polygon(0_0,50%_0,50%_100%,0_100%)]'">
                <span class="w-6 border-r border-white/10 bg-white/[0.04]" />
                <span class="flex flex-1 flex-col gap-1.5 p-2">
                  <span class="h-1.5 w-10 rounded-full bg-white/60" />
                  <span class="h-1 w-14 rounded-full bg-white/15" />
                  <span class="h-1 w-8 rounded-full bg-white/15" />
                  <span class="mt-auto h-2.5 w-7 rounded-full bg-[#c6f25a]" />
                </span>
              </span>
              <span v-if="t.value !== 'dark'" class="absolute inset-0 flex bg-[#f3f4f0]" :class="t.value === 'system' && '[clip-path:polygon(50%_0,100%_0,100%_100%,50%_100%)]'">
                <span class="w-6 border-r border-black/10 bg-black/[0.03]" />
                <span class="flex flex-1 flex-col gap-1.5 p-2">
                  <span class="h-1.5 w-10 rounded-full bg-black/70" />
                  <span class="h-1 w-14 rounded-full bg-black/15" />
                  <span class="h-1 w-8 rounded-full bg-black/15" />
                  <span class="mt-auto h-2.5 w-7 rounded-full bg-[#bee848]" />
                </span>
              </span>
            </span>
            <span :class="cn('text-sm font-medium', ui.theme === t.value ? 'text-fg' : 'text-muted')">{{ t.label }}</span>
          </button>
        </div>
      </Section>

      <Section title="Chat" description="Applied to every chat in the app. Apps using the API send their own.">
        <div class="max-w-[28rem]">
          <ChatSettingsForm />
        </div>
      </Section>

      <Section title="Local API" description="OpenAI-compatible. The address and key stay the same across launches.">
        <ValueRow label="Base URL" :value="`${baseUrl()}/v1`" />
        <ValueRow label="API key" :value="cfg.apiKey" />
        <p class="text-sm text-muted">
          Use a model's id, such as <code class="rounded-control bg-fg/[0.07] px-1.5 py-px font-mono text-xs text-fg">qwen2.5-7b-instruct-4bit</code>,
          as the model name. Stopped models load on the first request.
        </p>
      </Section>

      <Section title="Hugging Face" description="Optional. A token raises rate limits and unlocks gated models.">
        <HfTokenField :configured="settings?.hf_token_set ?? false" />
      </Section>

      <Section title="Storage" description="Where model weights are kept.">
        <div class="field flex h-control items-center gap-2.5 rounded-control pl-3 pr-1">
          <FolderOpen class="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
          <code class="selectable min-w-0 flex-1 truncate font-mono text-sm">{{ settings?.models_dir ?? "…" }}</code>
          <CopyButton v-if="settings" :text="settings.models_dir" label="Copy path" />
        </div>
      </Section>

      <Section title="Memory" description="How MLX Studio decides whether a model fits.">
        <!-- The rule, drawn: the same three zones the fit gauges use. -->
        <div class="flex flex-col gap-3">
          <div class="flex h-2.5 overflow-hidden rounded-full" aria-hidden="true">
            <span class="w-[55%] bg-safe/80" />
            <span class="w-[30%] bg-warn/80" />
            <span class="bg-hatch w-[15%]" />
          </div>
          <div class="grid grid-cols-[55%_30%_15%] text-xs text-muted">
            <span><span class="font-medium text-safe">Fits</span> — needs less than is free</span>
            <span><span class="font-medium text-warn">Tight</span> — macOS reclaims cache</span>
            <span>Reserve, 15%</span>
          </div>
          <p class="max-w-[56ch] text-sm text-muted">
            15% of memory is kept for macOS and your other apps. A model “fits” when it needs less than what is free after
            that reserve; “tight” models still start, because macOS reclaims cached memory, but other apps may slow down.
          </p>
        </div>
      </Section>
    </div>
  </div>
</template>
