import { Prisma } from "@/generated/prisma/client";
import { db, withWriteLock } from "@sezsec/db";
import {
  ACTION_PLAIN_LABELS,
  INVENTORY_LEDGER_ACTIONS,
  type ActivityLogEntry,
  type RecordLogInput,
} from "./logs.types";

export { ACTION_PLAIN_LABELS, INVENTORY_LEDGER_ACTIONS };

function mapRow(row: {
  id: string;
  action: string;
  summary: string;
  userId: string;
  userName: string;
  eventId: string | null;
  itemId: string | null;
  details: Prisma.JsonValue | null;
  timestamp: number;
  createdAt: Date;
}): ActivityLogEntry {
  return {
    id: row.id,
    action: row.action,
    summary: row.summary,
    userId: row.userId,
    userName: row.userName,
    eventId: row.eventId,
    itemId: row.itemId,
    details:
      row.details && typeof row.details === "object" && !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : null,
    timestamp: row.timestamp,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function recordActivity(input: RecordLogInput): Promise<void> {
  try {
    await withWriteLock(() =>
      db.activityLog.create({
        data: {
          action: input.action,
          summary: input.summary,
          userId: input.userId || "system",
          userName: input.userName || "Office Staff",
          eventId: input.eventId || null,
          itemId: input.itemId || null,
          details: input.details
            ? (input.details as Prisma.InputJsonObject)
            : Prisma.JsonNull,
          timestamp: input.timestamp ?? Date.now(),
        },
      })
    );
  } catch (err) {
    console.error("[SEZSEC Logs] Failed to record activity:", err);
  }
}

export async function listRecentActivity(limit = 200): Promise<ActivityLogEntry[]> {
  const rows = await db.activityLog.findMany({
    orderBy: { timestamp: "desc" },
    take: limit,
  });
  return rows.map(mapRow);
}

export async function listEventActivity(eventId: string): Promise<ActivityLogEntry[]> {
  const rows = await db.activityLog.findMany({
    where: { eventId },
    orderBy: { timestamp: "desc" },
    take: 150,
  });
  return rows.map(mapRow);
}

export async function listInventoryLedger(limit = 500): Promise<ActivityLogEntry[]> {
  const rows = await db.activityLog.findMany({
    where: {
      action: { in: INVENTORY_LEDGER_ACTIONS },
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });
  return rows.map(mapRow);
}
