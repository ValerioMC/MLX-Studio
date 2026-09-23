<script setup lang="ts">
import { RouterLink, useRoute } from "vue-router";
import Kbd from "@/components/ui/Kbd.vue";
import { cn } from "@/lib/utils";
import type { NavItem } from "./navigation";

defineProps<{ item: NavItem; badge?: number }>();
const route = useRoute();
</script>

<template>
  <RouterLink
    :to="item.to"
    :class="
      cn(
        'group relative flex h-7 items-center gap-2.5 rounded-md px-2 text-base font-medium transition-colors duration-100',
        route.path === item.to
          ? 'bg-accent/[0.1] text-foreground'
          : 'text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground',
      )
    "
  >
    <!-- A chosen row, not just a colored one: a small glowing capsule placed in
         the sidebar's gutter, inset from the row's edges, rather than a flat
         fill or a rail down one side. -->
    <span
      v-if="route.path === item.to"
      aria-hidden="true"
      class="absolute -left-2 bottom-1 top-1 w-[3px] rounded-full bg-accent shadow-[0_0_7px_rgb(var(--accent)/0.85)]"
    />
    <component
      :is="item.icon"
      :class="cn('h-[15px] w-[15px] shrink-0', route.path === item.to && 'text-accent')"
      :stroke-width="2"
    />
    <span class="flex-1 truncate">{{ item.label }}</span>
    <span
      v-if="badge"
      class="tabular min-w-[1.25rem] rounded-full bg-accent px-1.5 text-center text-2xs font-semibold leading-[1.1rem] text-accent-foreground"
    >
      {{ badge }}
    </span>
    <Kbd v-else class="opacity-0 transition-opacity group-hover:opacity-100">⌘{{ item.shortcut }}</Kbd>
  </RouterLink>
</template>
