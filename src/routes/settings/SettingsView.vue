<script setup lang="ts">
import { FolderOpen } from "lucide-vue-next";
import { baseUrl, getConfig } from "@/lib/api/client";
import { useAppSettings } from "@/lib/api/queries";
import { useUI, type Theme } from "@/stores/ui";
import Segmented from "@/components/ui/Segmented.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import CopyButton from "@/components/ui/CopyButton.vue";
import ChatSettingsForm from "@/routes/chat/ChatSettingsForm.vue";
import Section from "./Section.vue";
import ValueRow from "./ValueRow.vue";
import HfTokenField from "./HfTokenField.vue";

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
    <PageHeader title="Settings" />

    <Section title="Appearance" description="System follows your Mac's light or dark setting.">
      <Segmented :model-value="ui.theme" :options="THEMES" label="Theme" @update:model-value="ui.setTheme" />
    </Section>

    <Section title="Chat" description="Applied to every chat in the app. Apps using the API send their own.">
      <div class="max-w-[28rem]">
        <ChatSettingsForm />
      </div>
    </Section>

    <Section title="Local API" description="OpenAI-compatible. The address and key stay the same across launches.">
      <ValueRow label="Base URL" :value="`${baseUrl()}/v1`" />
      <ValueRow label="API key" :value="cfg.apiKey" />
      <p class="text-sm text-muted-foreground">
        Use a model's id, such as <code class="font-mono text-xs">qwen2.5-7b-instruct-4bit</code>, as the model
        name. Stopped models load on the first request.
      </p>
    </Section>

    <Section title="Hugging Face" description="Optional. A token raises rate limits and unlocks gated models.">
      <HfTokenField :configured="settings?.hf_token_set ?? false" />
    </Section>

    <Section title="Storage" description="Where model weights are kept.">
      <div class="flex items-center gap-3 text-base">
        <FolderOpen class="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <code class="min-w-0 flex-1 truncate rounded-md bg-muted/70 px-2 py-1 font-mono text-xs">{{
          settings?.models_dir ?? "…"
        }}</code>
        <CopyButton v-if="settings" :text="settings.models_dir" label="Copy path" />
      </div>
    </Section>

    <Section title="Memory" description="How MLX Studio decides whether a model fits.">
      <p class="max-w-[52ch] text-base text-muted-foreground">
        15% of memory is kept for macOS and your other apps. A model “fits” when it needs less than what is free
        after that reserve; “tight” models still start, because macOS reclaims cached memory, but other apps may
        slow down.
      </p>
    </Section>
  </div>
</template>
