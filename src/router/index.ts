import { createRouter, createWebHashHistory } from "vue-router";
import AppShell from "@/components/layout/AppShell.vue";
import DashboardView from "@/routes/dashboard/DashboardView.vue";

// Overview is the landing page, so it ships with the shell. Every other page
// is its own chunk: vue-router awaits a route's dynamic import as part of
// resolving the navigation, so the current page stays on screen until the
// next one is ready — there is no loading flash.
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      component: AppShell,
      children: [
        { path: "", name: "overview", component: DashboardView },
        { path: "chat", name: "chat", component: () => import("@/routes/chat/ChatView.vue") },
        { path: "models", name: "models", component: () => import("@/routes/models/ModelsView.vue") },
        { path: "catalog", name: "catalog", component: () => import("@/routes/catalog/CatalogView.vue") },
        { path: "downloads", name: "downloads", component: () => import("@/routes/downloads/DownloadsView.vue") },
        { path: "settings", name: "settings", component: () => import("@/routes/settings/SettingsView.vue") },
        // The primitive gallery: not in the nav, reachable from the palette.
        { path: "design", name: "design", component: () => import("@/routes/design/DesignView.vue") },
      ],
    },
  ],
});
