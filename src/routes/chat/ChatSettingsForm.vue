<script setup lang="ts">
import { computed } from "vue";
import Slider from "@/components/ui/Slider.vue";
import Button from "@/components/ui/Button.vue";
import { fieldClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { DEFAULT_CHAT_PREFERENCES, MAX_TOKENS_RANGE, TEMPERATURE_RANGE, usePreferences } from "@/stores/preferences";

/** System prompt, temperature and reply length, remembered across launches. */
const preferences = usePreferences();
const isDefault = computed(
  () =>
    preferences.systemPrompt === DEFAULT_CHAT_PREFERENCES.systemPrompt &&
    preferences.temperature === DEFAULT_CHAT_PREFERENCES.temperature &&
    preferences.maxTokens === DEFAULT_CHAT_PREFERENCES.maxTokens,
);
</script>

<template>
  <div class="flex flex-col gap-5">
    <label class="flex flex-col gap-2">
      <span class="text-base font-medium">System prompt</span>
      <textarea
        v-model="preferences.systemPrompt"
        rows="4"
        placeholder="How the model should behave in every chat, e.g. “Answer briefly. Use British spelling.”"
        :class="cn(fieldClass, 'resize-none py-2.5 leading-snug')"
      />
    </label>

    <div class="flex flex-col gap-1.5">
      <div class="flex items-baseline justify-between">
        <span class="text-base font-medium">Temperature</span>
        <span class="tabular font-mono text-sm font-medium">{{ preferences.temperature.toFixed(2) }}</span>
      </div>
      <Slider
        v-model="preferences.temperature"
        label="Temperature"
        :min="TEMPERATURE_RANGE.min"
        :max="TEMPERATURE_RANGE.max"
        :step="TEMPERATURE_RANGE.step"
        :ticks="5"
      />
      <div class="flex justify-between text-xs text-subtle">
        <span>Focused</span>
        <span>Varied</span>
      </div>
    </div>

    <div class="flex flex-col gap-1.5">
      <div class="flex items-baseline justify-between">
        <span class="text-base font-medium">Longest reply</span>
        <span class="tabular font-mono text-sm font-medium">
          {{ preferences.maxTokens.toLocaleString() }} <span class="font-sans font-normal text-muted">tokens</span>
        </span>
      </div>
      <Slider
        v-model="preferences.maxTokens"
        label="Longest reply"
        :min="MAX_TOKENS_RANGE.min"
        :max="MAX_TOKENS_RANGE.max"
        :step="MAX_TOKENS_RANGE.step"
      />
      <p class="text-xs text-muted">Reasoning models spend part of this on thinking.</p>
    </div>

    <div class="flex justify-end border-t border-line pt-3">
      <Button variant="ghost" size="sm" :disabled="isDefault" @click="preferences.resetChat()">Restore defaults</Button>
    </div>
  </div>
</template>
