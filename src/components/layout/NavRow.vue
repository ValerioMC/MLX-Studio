<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import Kbd from "@/components/ui/Kbd.vue";
import { cn } from "@/lib/utils";
import type { NavItem } from "./navigation";

const props = defineProps<{ item: NavItem; badge?: number }>();
const route = useRoute();
const current = computed(() => route.path === props.item.to);
</script>

<template>
  <!-- Selection looks *chosen*, not colored: the row lifts onto a raised
       surface with a hairline, a soft light blooms from its left edge, and a
       short glowing capsule is placed in the rail's gutter, inset from the
       row's top and bottom, like a marker set down beside it. -->
  <RouterLink
    :to="item.to"
    :aria-current="current ? 'page' : undefined"
    :class="
      cn(
        'group relative flex h-row items-center gap-3 rounded-control px-2.5 text-base font-medium transition-[background-color,color,box-shadow] duration-150',
        current
          ? 'bg-[radial-gradient(120%_140%_at_0%_50%,rgb(var(--accent)/0.13),transparent_60%),rgb(var(--raised)/0.9)] text-fg shadow-lift ring-1 ring-inset ring-line-strong/60'
          : 'text-muted hover:bg-fg/[0.045] hover:text-fg',
      )
    "
  >
    <Transition name="crossfade">
      <span
        v-if="current"
        aria-hidden="true"
        class="absolute -left-3 bottom-2 top-2 w-[3px] rounded-full bg-accent shadow-[0_0_10px_1px_rgb(var(--accent)/0.75)]"
      />
    </Transition>
    <component
      :is="item.icon"
      :class="cn('h-[16px] w-[16px] shrink-0 transition-colors', current ? 'text-accent-text' : 'text-subtle group-hover:text-muted')"
      :stroke-width="1.9"
    />
    <span class="flex-1 truncate">{{ item.label }}</span>
    <span
      v-if="badge"
      class="tabular grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1.5 text-2xs font-bold text-accent-ink shadow-[0_0_10px_-2px_rgb(var(--accent)/0.8)]"
    >
      {{ badge }}
    </span>
    <Kbd v-else class="opacity-0 transition-opacity duration-150 group-hover:opacity-100">⌘{{ item.shortcut }}</Kbd>
  </RouterLink>
</template>
