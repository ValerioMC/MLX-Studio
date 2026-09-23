<script setup lang="ts">
import { ref } from "vue";
import { useMutation } from "@tanstack/vue-query";
import { api } from "@/lib/api/client";
import { queryClient, queryKeys } from "@/lib/api/queries";
import Button from "@/components/ui/Button.vue";
import { fieldClass } from "@/components/ui/field";
import { openExternal } from "@/lib/openExternal";
import { cn } from "@/lib/utils";

defineProps<{ configured: boolean }>();

const token = ref("");
const status = ref<string | null>(null);
const {
  mutate: save,
  isPending,
  isError,
  variables,
} = useMutation({
  mutationFn: (value: string | null) =>
    api<{ hf_token_set: boolean }>("/settings/hf-token", { method: "PUT", body: JSON.stringify({ token: value }) }),
  onSuccess: (_res, value) => {
    token.value = "";
    status.value = value ? "Token saved." : "Token removed.";
    void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
  },
  onError: (e: Error) => {
    status.value = e.message;
  },
});

function onSubmit(): void {
  if (token.value.trim()) save(token.value.trim());
}
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <form class="flex items-center gap-2" @submit.prevent="onSubmit">
      <input
        v-model="token"
        type="password"
        :placeholder="configured ? 'A token is saved. Paste a new one to replace it.' : 'hf_…'"
        aria-label="Hugging Face token"
        autocomplete="off"
        spellcheck="false"
        :class="cn(fieldClass, 'h-control flex-1 font-mono text-sm')"
      />
      <Button type="submit" :disabled="!token.trim()" :loading="isPending && variables !== null">
        Save
      </Button>
      <Button v-if="configured" variant="secondary" :loading="isPending && variables === null" @click="save(null)">
        Remove
      </Button>
    </form>
    <p :class="['text-sm', isError ? 'text-danger' : 'text-muted']">
      <template v-if="status">{{ status }}</template>
      <template v-else>
        Create a read token at
        <button
          type="button"
          class="font-medium text-accent-text hover:underline"
          @click="openExternal('https://huggingface.co/settings/tokens')"
        >
          huggingface.co/settings/tokens
        </button>
        .
      </template>
    </p>
  </div>
</template>
