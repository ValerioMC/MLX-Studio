import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { NAV_ITEMS, SETTINGS_ITEM } from "./navigation";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";
import { startLiveFeeds } from "@/stores/live";
import { useChat } from "@/stores/chat";

const SHORTCUT_ROUTES = new Map([...NAV_ITEMS, SETTINGS_ITEM].map((item) => [item.shortcut, item.to]));

/** App-wide keyboard map: ⌘1–5 and ⌘, switch pages, ⌘N starts a new chat. */
function useGlobalShortcuts(): void {
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.metaKey || event.altKey || event.ctrlKey) return;
      const route = SHORTCUT_ROUTES.get(event.key);
      if (route) {
        event.preventDefault();
        navigate(route);
        return;
      }
      if (event.key.toLowerCase() === "n" && !event.shiftKey) {
        event.preventDefault();
        const chat = useChat.getState();
        if (!chat.busy) chat.reset();
        navigate("/chat");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}

export function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => startLiveFeeds(), []);
  useGlobalShortcuts();

  // Chat owns its full height (thread + composer); other pages scroll.
  const fullBleed = pathname === "/chat";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div data-tauri-drag-region className="h-12 w-full shrink-0" />
        <ConnectionBanner />
        <div className="no-drag min-h-0 flex-1 overflow-y-auto" key={fullBleed ? "chat" : "page"}>
          {fullBleed ? (
            <Outlet />
          ) : (
            <div className="mx-auto w-full max-w-[64rem] px-8 pb-16">
              <Outlet />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
