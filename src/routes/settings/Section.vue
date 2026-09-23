<script setup lang="ts">
defineProps<{ title: string; description: string }>();
</script>

<template>
  <!-- A settings group: its name and purpose on the left, controls on the right. -->
  <section class="grid grid-cols-1 gap-x-10 gap-y-3 border-t py-6 md:grid-cols-[15rem_minmax(0,1fr)]">
    <div>
      <h2 class="text-md font-semibold">{{ title }}</h2>
      <p class="pt-0.5 text-sm text-muted-foreground">{{ description }}</p>
    </div>
    <div class="flex min-w-0 flex-col gap-3">
      <slot />
    </div>
  </section>
</template>
