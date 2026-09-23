<template>
  <!-- A key cap: a tiny raised key with a darker bottom lip, so a shortcut
       reads as something you press, not as a stray code span. -->
  <kbd
    class="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-control border border-line-strong/80 border-b-line-strong bg-raised px-1 font-sans text-2xs font-medium text-subtle shadow-[inset_0_-1px_0_rgb(0_0_0/0.25)]"
  >
    <slot />
  </kbd>
</template>
