import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import { router } from "./router";
import { initRuntimeConfig } from "@/lib/api/client";
import { queryClient } from "@/lib/api/queries";
import { useUI } from "@/stores/ui";
import "./styles/globals.css";

async function bootstrap(): Promise<void> {
  await initRuntimeConfig();

  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  // Apply the persisted (or system) theme before mounting, so first paint is
  // never wrong: dark is the CSS default, and this only ever adds ".light".
  useUI(pinia);

  app.use(router);
  app.use(VueQueryPlugin, { queryClient });
  app.mount("#app");
}

void bootstrap();
