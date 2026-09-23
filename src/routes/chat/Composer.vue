<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { ArrowUp, ImagePlus, Square, X } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import { cn } from "@/lib/utils";
import { imageForModel } from "@/lib/image";
import { useChat } from "@/stores/chat";

const MAX_ATTACHMENTS = 4;
const MAX_HEIGHT_PX = 220;

const props = defineProps<{ disabled: boolean; placeholder: string; canAttach: boolean }>();
const emit = defineEmits<{ send: [text: string, images: string[]]; stop: [] }>();

const chat = useChat();
const attachments = ref<string[]>([]);
const dragging = ref(false);
const textRef = ref<HTMLTextAreaElement | null>(null);
const fileRef = ref<HTMLInputElement | null>(null);

// Grow with the text, up to a limit, then scroll.
watch(
  () => chat.input,
  async () => {
    await nextTick();
    const el = textRef.value;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  },
);

watch(
  () => props.disabled,
  (disabled) => {
    if (!disabled) textRef.value?.focus();
  },
  { immediate: true },
);

async function addImages(files: Iterable<File>): Promise<void> {
  const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
  const urls = await Promise.all(images.map(imageForModel));
  attachments.value = [...attachments.value, ...urls].slice(0, MAX_ATTACHMENTS);
}

function canSend(): boolean {
  return !props.disabled && !chat.busy && (chat.input.trim() !== "" || attachments.value.length > 0);
}

function send(): void {
  if (!canSend()) return;
  emit("send", chat.input, attachments.value);
  attachments.value = [];
}

function onKeydown(event: KeyboardEvent): void {
  // Enter confirms an IME composition (Japanese, Chinese); it must not send.
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    send();
  }
}

function onPaste(event: ClipboardEvent): void {
  if (!props.canAttach) return;
  const files = Array.from(event.clipboardData?.files ?? []);
  if (files.length) {
    event.preventDefault();
    void addImages(files);
  }
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  void addImages(input.files ?? []);
  input.value = "";
}

function onDragOver(event: DragEvent): void {
  if (!props.canAttach) return;
  event.preventDefault();
  dragging.value = true;
}
function onDrop(event: DragEvent): void {
  if (!props.canAttach) return;
  event.preventDefault();
  dragging.value = false;
  void addImages(event.dataTransfer?.files ?? []);
}
</script>

<template>
  <div
    :class="
      cn(
        'rounded-xl border border-input bg-card p-2 shadow-[0_1px_2px_rgb(0_0_0_/_0.12)] transition-colors focus-within:border-accent/60',
        dragging && 'border-accent bg-accent/[0.04]',
        disabled && 'opacity-60',
      )
    "
    @dragover="onDragOver"
    @dragleave="dragging = false"
    @drop="onDrop"
  >
    <ul v-if="attachments.length > 0" class="flex flex-wrap gap-2 px-1.5 pb-2 pt-1">
      <li v-for="(src, i) in attachments" :key="i" class="relative">
        <img :src="src" :alt="`Attachment ${i + 1}`" class="h-16 w-16 rounded-lg border object-cover" />
        <button
          type="button"
          :aria-label="`Remove attachment ${i + 1}`"
          class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background hover:bg-destructive"
          @click="attachments = attachments.filter((_, k) => k !== i)"
        >
          <X class="h-3 w-3" />
        </button>
      </li>
    </ul>
    <div class="flex items-end gap-1.5">
      <template v-if="canAttach">
        <input ref="fileRef" type="file" accept="image/*" multiple class="hidden" @change="onFileChange" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Attach images"
          title="Attach images (you can also paste or drop them)"
          :disabled="disabled || attachments.length >= MAX_ATTACHMENTS"
          @click="fileRef?.click()"
        >
          <ImagePlus />
        </Button>
      </template>
      <textarea
        ref="textRef"
        v-model="chat.input"
        :disabled="disabled"
        rows="1"
        aria-label="Message"
        :placeholder="placeholder"
        class="max-h-[220px] min-h-[2rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-md leading-relaxed outline-none placeholder:text-muted-foreground/70"
        @keydown="onKeydown"
        @paste="onPaste"
      />
      <Button
        v-if="chat.busy"
        variant="secondary"
        size="icon"
        aria-label="Stop generating"
        title="Stop"
        class="rounded-full"
        @click="emit('stop')"
      >
        <Square class="fill-current" />
      </Button>
      <Button v-else size="icon" aria-label="Send" title="Send" :disabled="!canSend()" class="rounded-full" @click="send">
        <ArrowUp />
      </Button>
    </div>
  </div>
</template>
