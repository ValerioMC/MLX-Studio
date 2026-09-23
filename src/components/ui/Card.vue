<script setup lang="ts">
import { cn } from "@/lib/utils";

/**
 * A panel standing in the room. `interactive` lifts on hover (rises 2px, the
 * border warms, the shadow opens) so a card you can click and one you can't
 * are told apart before the pointer reaches them. `lit` is reserved for the
 * one object on a page that is *live* — it gets the glow tier.
 */
withDefaults(defineProps<{ interactive?: boolean; lit?: boolean; as?: string }>(), {
  interactive: false,
  lit: false,
  as: "div",
});
</script>

<template>
  <component
    :is="as"
    :class="
      cn(
        'edge-lit rounded-card border border-line bg-surface/80 shadow-lift',
        interactive &&
          'cursor-pointer transition-[transform,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-strong hover:bg-raised/80',
        lit && 'border-accent-line',
      )
    "
  >
    <slot />
  </component>
</template>
