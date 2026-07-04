import { cn } from "@/lib/utils";
import {
  Boxes,
  LayoutDashboard,
  MessageSquare,
  Download,
  Settings,
  Store,
  Circle,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Model, DownloadJob } from "@/types";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/catalog", label: "Catalog", icon: Store },
  { to: "/downloads", label: "Downloads", icon: Download },
  { to: "/models", label: "Models", icon: Boxes },
  { to: "/chat", label: "Chat", icon: MessageSquare },
];

export function Sidebar() {
  const { data: models } = useQuery({
    queryKey: ["models"],
    queryFn: () => api<Model[]>("/models"),
    refetchInterval: 4000,
  });
  const { data: downloads } = useQuery({
    queryKey: ["downloads"],
    queryFn: () => api<{ items: DownloadJob[] }>("/downloads"),
    refetchInterval: 2000,
  });

  const running = models?.filter((m) => m.status === "running") ?? [];
  const activeDownloads =
    downloads?.items.filter((d) => d.status === "downloading").length ?? 0;

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-sidebar">
      {/* Space for traffic-light controls; doubles as a window drag handle */}
      <div data-tauri-drag-region className="h-11" />

      <div className="px-4 pb-4 pt-1">
        <span className="font-display text-sm font-bold uppercase tracking-[0.2em] text-accent text-glow">
          MLX Studio
        </span>
      </div>

      <nav className="no-drag flex flex-col gap-0.5 px-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent/10 text-accent text-glow ring-1 ring-accent/40"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            {label === "Downloads" && activeDownloads > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-xs text-accent-foreground">
                {activeDownloads}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-3 pb-2">
        {running.length > 0 && (
          <div className="mb-2 rounded-md bg-muted/50 p-2">
            <p className="mb-1 px-1 text-xs font-medium text-muted-foreground">Running</p>
            {running.map((m) => (
              <div key={m.id} className="flex items-center gap-2 px-1 py-0.5 text-xs">
                <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                <span className="truncate">{m.display_name}</span>
              </div>
            ))}
          </div>
        )}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "no-drag flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
