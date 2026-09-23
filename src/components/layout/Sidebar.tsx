import { cn } from "@/lib/utils";
import { NavLink, useNavigate } from "react-router-dom";
import { useModels } from "@/lib/api/queries";
import { activeDownloadCount, useLive } from "@/stores/live";
import { useChat } from "@/stores/chat";
import { useMemoryLedger } from "@/hooks/useMemoryLedger";
import { FreeForModels, LedgerBar } from "@/components/system/MemoryLedger";
import { Kbd, StatusDot } from "@/components/ui/primitives";
import { contextSize } from "@/lib/format";
import { NAV_ITEMS, SETTINGS_ITEM, type NavItem } from "./navigation";

function NavRow({ item, badge }: { item: NavItem; badge?: number }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group flex h-7 items-center gap-2.5 rounded-md px-2 text-base font-medium transition-colors duration-100",
          isActive ? "bg-foreground/[0.07] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn("h-[15px] w-[15px] shrink-0", isActive && "text-accent")} strokeWidth={2} />
          <span className="flex-1 truncate">{item.label}</span>
          {badge ? (
            <span className="tabular min-w-[1.25rem] rounded-full bg-accent px-1.5 text-center text-2xs font-semibold leading-[1.1rem] text-accent-foreground">
              {badge}
            </span>
          ) : (
            <Kbd className="opacity-0 transition-opacity group-hover:opacity-100">⌘{item.shortcut}</Kbd>
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const { data: models } = useModels();
  const downloads = useLive((s) => s.downloads);
  const stats = useLive((s) => s.stats);
  const ledger = useMemoryLedger();
  const setModel = useChat((s) => s.setModel);

  const running = models?.filter((m) => m.status === "running") ?? [];
  const contextOf = new Map(stats?.loaded_models.map((m) => [m.model_id, m.context_length]) ?? []);
  const activeDownloads = activeDownloadCount(downloads);

  return (
    <aside className="flex h-full w-[13.5rem] shrink-0 flex-col border-r bg-sidebar">
      {/* Room for the traffic lights; doubles as a window drag handle. */}
      <div data-tauri-drag-region className="h-12 shrink-0" />

      <div data-tauri-drag-region className="px-4 pb-4">
        <span className="text-md font-semibold tracking-[-0.01em]">MLX Studio</span>
      </div>

      <nav aria-label="Main" className="no-drag flex flex-col gap-px px-2">
        {NAV_ITEMS.map((item) => (
          <NavRow key={item.to} item={item} badge={item.to === "/downloads" ? activeDownloads : undefined} />
        ))}
      </nav>

      {running.length > 0 && (
        <section aria-label="Running models" className="no-drag mt-6 px-2">
          <h2 className="px-2 pb-1 text-xs font-medium text-muted-foreground">Running</h2>
          <ul className="flex flex-col gap-px">
            {running.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  title={`Chat with ${m.display_name}`}
                  onClick={() => {
                    setModel(m.id);
                    navigate("/chat");
                  }}
                  className="flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm text-foreground/90 transition-colors hover:bg-foreground/[0.04]"
                >
                  <StatusDot tone="positive" className="mx-1" />
                  <span className="min-w-0 flex-1 truncate">{m.display_name}</span>
                  {contextOf.has(m.id) && (
                    <span className="tabular text-2xs text-muted-foreground">{contextSize(contextOf.get(m.id) ?? 0)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="no-drag mt-auto flex flex-col gap-2 px-2 pb-3">
        {ledger && (
          <NavLink
            to="/"
            title="Unified memory"
            className="flex flex-col gap-1.5 rounded-md px-2 py-2 transition-colors hover:bg-foreground/[0.04]"
          >
            <LedgerBar ledger={ledger} height="h-2.5" className="rounded-[4px] p-[1.5px]" />
            <FreeForModels ledger={ledger} size="compact" />
          </NavLink>
        )}
        <NavRow item={SETTINGS_ITEM} />
      </div>
    </aside>
  );
}
