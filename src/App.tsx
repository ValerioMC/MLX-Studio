import { createHashRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardView } from "@/routes/dashboard/DashboardView";
import { CatalogView } from "@/routes/catalog/CatalogView";
import { DownloadsView } from "@/routes/downloads/DownloadsView";
import { ModelsView } from "@/routes/models/ModelsView";
import { ChatView } from "@/routes/chat/ChatView";
import { SettingsView } from "@/routes/settings/SettingsView";

const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardView /> },
      { path: "catalog", element: <CatalogView /> },
      { path: "downloads", element: <DownloadsView /> },
      { path: "models", element: <ModelsView /> },
      { path: "chat", element: <ChatView /> },
      { path: "settings", element: <SettingsView /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
