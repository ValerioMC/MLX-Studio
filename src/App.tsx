import { createHashRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/routes/dashboard/DashboardView";

// Overview is the landing page, so it ships with the shell. Every other page is
// its own chunk, fetched by the router before it navigates: the current page
// stays on screen until the next one is ready, so there is no loading flash.
const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardView /> },
      {
        path: "catalog",
        lazy: () => import("@/routes/catalog/CatalogView").then((m) => ({ Component: m.CatalogView })),
      },
      {
        path: "downloads",
        lazy: () => import("@/routes/downloads/DownloadsView").then((m) => ({ Component: m.DownloadsView })),
      },
      {
        path: "models",
        lazy: () => import("@/routes/models/ModelsView").then((m) => ({ Component: m.ModelsView })),
      },
      {
        path: "chat",
        lazy: () => import("@/routes/chat/ChatView").then((m) => ({ Component: m.ChatView })),
      },
      {
        path: "settings",
        lazy: () => import("@/routes/settings/SettingsView").then((m) => ({ Component: m.SettingsView })),
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
