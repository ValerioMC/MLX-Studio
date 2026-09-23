import { Boxes, Download, Gauge, MessageSquare, Settings, Store, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Key pressed with ⌘ to go there. */
  shortcut: string;
  end?: boolean;
}

/** Ordered by how often each is used, not by the order a first model is set up in. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Overview", icon: Gauge, shortcut: "1", end: true },
  { to: "/chat", label: "Chat", icon: MessageSquare, shortcut: "2" },
  { to: "/models", label: "Models", icon: Boxes, shortcut: "3" },
  { to: "/catalog", label: "Catalog", icon: Store, shortcut: "4" },
  { to: "/downloads", label: "Downloads", icon: Download, shortcut: "5" },
];

export const SETTINGS_ITEM: NavItem = { to: "/settings", label: "Settings", icon: Settings, shortcut: "," };
