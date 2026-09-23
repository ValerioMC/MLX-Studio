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
  <Popover :open="open" label="Chat settings" @close="open = false">
    <template #trigger>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Chat settings"
        :aria-expanded="open"
        title="Chat settings"
        :class="cn('relative', open && 'bg-muted text-foreground')"
        @click="open = !open"
      >
        <SlidersHorizontal />
        <span v-if="customized" aria-hidden="true" class="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
      </Button>
    </template>
    <ChatSettingsForm />
  </Popover>
</template>
