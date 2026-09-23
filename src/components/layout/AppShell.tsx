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

/** Event the menu-bar item sends to open Chat with a model (see src-tauri/src/tray.rs). */
const TRAY_OPEN_CHAT_EVENT = "tray:open-chat";

/** The menu-bar item's "Open chat": select that model and go to Chat. */
function useTrayOpenChat(): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return; // browser dev: there is no tray
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen<string>(TRAY_OPEN_CHAT_EVENT, ({ payload }) => {
        useChat.getState().setModel(payload);
        navigate("/chat");
      }).then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      }),
    );
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [navigate]);
}

export function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => startLiveFeeds(), []);
  useGlobalShortcuts();
  useTrayOpenChat();

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
