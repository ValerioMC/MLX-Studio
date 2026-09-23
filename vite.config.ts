import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

// Tauri expects a fixed dev port and ignores Vite's own hashing of public assets.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "safari15",
    sourcemap: true,
  },
});
