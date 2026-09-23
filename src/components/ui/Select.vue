<script setup lang="ts" generic="T extends string">
import { computed, nextTick, ref, useId } from "vue";
import { Check, ChevronsUpDown } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import Popover from "./Popover.vue";

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  hint?: string;
}

/**
 * One value from a list, in the app's own chrome instead of the OS menu (a
 * native popup on this canvas is a light-gray system sheet — the one place
 * the room would suddenly end). A listbox with the full keyboard contract:
 * ↑/↓ move, Home/End jump, Enter/Space pick, Escape closes, typing a letter
 * jumps to the first option starting with it. Slots `option` and `value` let
 * a caller draw more than a label (Chat puts each model's core in front).
 */
const props = withDefaults(
  defineProps<{
    modelValue: T;
    options: readonly SelectOption<T>[];
    label: string;
    disabled?: boolean;
    size?: "sm" | "md";
    triggerClass?: string;
  }>(),
  { disabled: false, size: "md" },
);
const emit = defineEmits<{ "update:modelValue": [value: T] }>();

const open = ref(false);
const active = ref(0);
const listRef = ref<HTMLUListElement | null>(null);
const triggerRef = ref<HTMLButtonElement | null>(null);
const listId = `select-${useId()}`;
const current = computed(() => props.options.find((o) => o.value === props.modelValue));

async function show(): Promise<void> {
  if (props.disabled) return;
  active.value = Math.max(0, props.options.findIndex((o) => o.value === props.modelValue));
  open.value = true;
  await nextTick();
  listRef.value?.focus();
}
function close(refocus: boolean): void {
  open.value = false;
  if (refocus) triggerRef.value?.focus();
}
function pick(value: T): void {
  emit("update:modelValue", value);
  close(true);
}

function onListKey(event: KeyboardEvent): void {
  const last = props.options.length - 1;
  const moves: Record<string, number> = {
    ArrowDown: Math.min(active.value + 1, last),
    ArrowUp: Math.max(active.value - 1, 0),
    Home: 0,
    End: last,
  };
  if (event.key in moves) {
    event.preventDefault();
    active.value = moves[event.key] ?? 0;
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    const option = props.options[active.value];
    if (option) pick(option.value);
    return;
  }
  if (event.key === "Tab") {
    close(false);
    return;
  }
  if (event.key.length === 1) {
    const found = props.options.findIndex((o) => o.label.toLowerCase().startsWith(event.key.toLowerCase()));
    if (found !== -1) active.value = found;
  }
}
</script>

<template>
  <Popover :open="open" :label="label" align="end" panel-class="w-auto min-w-full p-1.5" @close="close(false)">
    <template #trigger>
      <button
        ref="triggerRef"
        type="button"
        :disabled="disabled"
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="open ? listId : undefined"
        :aria-label="`${label}: ${current?.label ?? ''}`"
        :class="
          cn(
            'no-drag inline-flex w-full items-center gap-2 rounded-control bg-raised pl-3 pr-2 text-left font-medium text-fg shadow-lift ring-1 ring-inset ring-line transition-colors hover:bg-hover hover:ring-line-strong disabled:opacity-50',
            size === 'sm' ? 'h-control-sm text-sm' : 'h-control text-base',
            open && 'ring-line-strong',
            triggerClass,
          )
        "
        @click="open ? close(false) : show()"
        @keydown.down.prevent="show()"
        @keydown.up.prevent="show()"
      >
        <span class="flex min-w-0 flex-1 items-center gap-2 truncate">
          <slot name="value" :option="current">{{ current?.label }}</slot>
        </span>
        <ChevronsUpDown class="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
      </button>
    </template>

    <ul
      :id="listId"
      ref="listRef"
      role="listbox"
      tabindex="-1"
      :aria-label="label"
      :aria-activedescendant="`${listId}-${active}`"
      class="flex max-h-[18rem] flex-col gap-px overflow-y-auto outline-none"
      @keydown="onListKey"
    >
      <li
        v-for="(option, i) in options"
        :id="`${listId}-${i}`"
        :key="option.value"
        role="option"
        :aria-selected="option.value === modelValue"
        :class="
          cn(
            'flex h-row cursor-default items-center gap-2.5 whitespace-nowrap rounded-control pl-2.5 pr-3 text-base',
            i === active ? 'bg-fg/[0.07] text-fg' : 'text-muted',
          )
        "
        @mousemove="active = i"
        @click="pick(option.value)"
      >
        <span class="grid w-3.5 shrink-0 place-items-center">
          <Check v-if="option.value === modelValue" class="h-3.5 w-3.5 text-accent-text" :stroke-width="2.5" />
        </span>
        <span class="flex min-w-0 flex-1 items-center gap-2">
          <slot name="option" :option="option">{{ option.label }}</slot>
        </span>
        <span v-if="option.hint" class="tabular pl-4 text-xs text-subtle">{{ option.hint }}</span>
      </li>
    </ul>
  </Popover>
</template>
