export type LogActionType =
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_CANCELLED"
  | "EVENT_DELETED"
  | "INVENTORY_ISSUED"
  | "INVENTORY_RETURNED"
  | "INVENTORY_LOST"
  | "INVENTORY_RECOVERED"
  | "STOCK_ADDED"
  | "STOCK_UPDATED"
  | "STOCK_DELETED"
  | "AMOUNT_UPDATED"
  | "AMOUNT_UNLOCKED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "MIGRATION_COMPLETED"
  | "SYSTEM_RESET";

export interface RecordLogInput {
  action: LogActionType | string;
  summary: string;
  userId: string;
  userName: string;
  eventId?: string | null;
  itemId?: string | null;
  details?: Record<string, unknown> | null;
  timestamp?: number;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  summary: string;
  userId: string;
  userName: string;
  eventId: string | null;
  itemId: string | null;
  details: Record<string, unknown> | null;
  timestamp: number;
  createdAt: string;
}

export const INVENTORY_LEDGER_ACTIONS = [
  "INVENTORY_ISSUED",
  "INVENTORY_RETURNED",
  "INVENTORY_LOST",
  "INVENTORY_RECOVERED",
  "INVENTORY_ADDED",
  "INVENTORY_REMOVED",
  "INVENTORY_LOSS",
  "STOCK_ADDED",
  "STOCK_UPDATED",
  "STOCK_DELETED",
];

export const ACTION_PLAIN_LABELS: Record<string, string> = {
  EVENT_CREATED: "New Booking Created",
  EVENT_UPDATED: "Booking Updated",
  EVENT_CANCELLED: "Booking Cancelled",
  EVENT_DELETED: "Booking Removed",
  INVENTORY_ISSUED: "Items Given Out",
  INVENTORY_REMOVED: "Items Given Out",
  INVENTORY_RETURNED: "Items Returned",
  INVENTORY_LOST: "Items Marked Missing",
  INVENTORY_LOSS: "Items Marked Missing",
  INVENTORY_RECOVERED: "Missing Items Found",
  STOCK_ADDED: "New Store Item Added",
  STOCK_UPDATED: "Store Stock Updated",
  STOCK_DELETED: "Store Item Removed",
  AMOUNT_UPDATED: "Charges Saved",
  AMOUNT_UNLOCKED: "Charges Viewed (Email Verified)",
  USER_CREATED: "Team Member Added",
  USER_UPDATED: "Team Member Updated",
  USER_DELETED: "Team Member Removed",
  USER_LOGIN: "Signed In",
  USER_LOGOUT: "Signed Out",
  MIGRATION_COMPLETED: "Previous Office Records Synced",
  SYSTEM_RESET: "Records Cleared",
};
