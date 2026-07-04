import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";

export function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div data-tauri-drag-region className="h-11 w-full shrink-0" />
        <ConnectionBanner />
        <div className="no-drag min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex h-full max-w-6xl flex-col px-8 pb-12">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
