import { Boxes, Download, Gauge, MessageSquare, Settings, Store } from "lucide-vue-next";
import type { Component } from "vue";

export interface NavItem {
  to: string;
  label: string;
  icon: Component;
  /** Key pressed with ⌘ to go there. */
  shortcut: string;
}

/** Ordered by how often each is used, not by the order a first model is set up in. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Overview", icon: Gauge, shortcut: "1" },
  { to: "/chat", label: "Chat", icon: MessageSquare, shortcut: "2" },
  { to: "/models", label: "Models", icon: Boxes, shortcut: "3" },
  { to: "/catalog", label: "Catalog", icon: Store, shortcut: "4" },
  { to: "/downloads", label: "Downloads", icon: Download, shortcut: "5" },
];

export const SETTINGS_ITEM: NavItem = { to: "/settings", label: "Settings", icon: Settings, shortcut: "," };
