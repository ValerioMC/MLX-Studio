<script setup lang="ts">
import { computed, ref } from "vue";
import { SlidersHorizontal } from "lucide-vue-next";
import Popover from "@/components/ui/Popover.vue";
import Button from "@/components/ui/Button.vue";
import ChatSettingsForm from "./ChatSettingsForm.vue";
import { usePreferences } from "@/stores/preferences";
import { cn } from "@/lib/utils";

const open = ref(false);
const preferences = usePreferences();
const customized = computed(() => preferences.systemPrompt.trim() !== "");
</script>

<template>
  <Popover :open="open" label="Chat settings" panel-class="w-[23rem] p-5" @close="open = false">
    <template #trigger>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Chat settings"
        :aria-expanded="open"
        title="Chat settings"
        :class="cn('relative', open && 'bg-fg/[0.06] text-fg')"
        @click="open = !open"
      >
        <SlidersHorizontal />
        <span
          v-if="customized"
          aria-hidden="true"
          title="A system prompt is set"
          class="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_rgb(var(--accent)/0.9)]"
        />
      </Button>
    </template>
    <h2 class="pb-3 text-md font-semibold">Chat settings</h2>
    <ChatSettingsForm />
  </Popover>
</template>
