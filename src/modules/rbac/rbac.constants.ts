import type { AppRole } from "@sezsec/shared";

export const PORTAL_ROLES: AppRole[] = [
  "ADMIN",
  "ADMIN_CUSTOM",
  "MANAGER",
  "STAFF",
  "WATCHER",
  "USER",
];

export const PAGE_ACCESS_RULES: Record<string, AppRole[]> = {
  "/": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER"],
  "/profile": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER", "USER"],
  "/complete-profile": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER", "USER"],

  "/events": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER"],
  "/events/new": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "/events/calendar": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER"],
  "/events/floor-plan": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER"],
  "/events/[id]": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER"],
  "/events/[id]/edit": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "/events/[id]/inventory": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF"],
  "/events/[id]/print": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER"],

  "/inventory": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER"],
  "/inventory/add": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF"],
  "/inventory/[id]/edit": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF"],

  "/lost-items": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER"],
  "/ledger": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "/logs": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "/export-data": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],

  "/settings": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
};

export const ACTION_ACCESS_RULES: Record<string, AppRole[]> = {
  "event:create": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "event:edit": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "event:cancel": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "event:delete": ["ADMIN"],
  "event:print": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF", "WATCHER"],
  "event:costs:view": ["ADMIN"],
  "event:costs:edit": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],

  "inventory:issue-return": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF"],
  "inventory:manage": ["ADMIN", "ADMIN_CUSTOM", "MANAGER", "STAFF"],
  "inventory:delete": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],

  "floor-plan:edit": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],

  "settings:venues": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "settings:caterers": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "settings:decorators": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "settings:general": ["ADMIN", "ADMIN_CUSTOM", "MANAGER"],
  "settings:users": ["ADMIN"],
  "settings:migration": ["ADMIN"],
  "settings:backup": ["ADMIN"],
  "settings:reset": ["ADMIN"],
};

export const EVENT_CHARGES_MODULE_ID = "event_charges" as const;

export const DEFAULT_STAFF_MODULE_IDS = [
  "events-module",
  "inventory-module",
  "ledger-module",
  "settings-module",
] as const;

export const DEFAULT_PORTAL_MODULES = [
  {
    id: "events-module",
    name: "Hall Bookings & Events",
    description: "Book halls, manage arrangements, and print booking forms",
    icon: "CalendarDays",
  },
  {
    id: EVENT_CHARGES_MODULE_ID,
    name: "Event Charges",
    description:
      "Unlock with 6-digit email code to view, edit, and print booking rupee charges & deposits",
    icon: "IndianRupee",
  },
  {
    id: "inventory-module",
    name: "Vessel & Crockery Store",
    description: "Track store stock, event issue/return items, and missing items",
    icon: "Package",
  },
  {
    id: "ledger-module",
    name: "Stock Movement Book",
    description: "View full item issue and return register",
    icon: "BookOpen",
  },
  {
    id: "settings-module",
    name: "Office Settings",
    description: "Manage halls, caterers, decorators, and booking rules",
    icon: "Settings",
  },
] as const;
