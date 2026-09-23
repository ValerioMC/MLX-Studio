<script setup lang="ts">
import appIcon from "@/assets/app-icon.png";

/**
 * The app's mark in the rail is the app's own icon (the signal "M" through a
 * silicon die, on a matte graphite plate), so the window and the Dock carry
 * one identity. Rendered from src-tauri/icons/icon.svg; regenerate this copy
 * whenever the icon changes.
 */
withDefaults(defineProps<{ size?: number }>(), { size: 36 });
</script>

<template>
  <img
    :src="appIcon"
    alt=""
    aria-hidden="true"
    draggable="false"
    class="shrink-0 select-none"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
</template>
