import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma, type EventType } from "@/generated/prisma/client";
import { db, withWriteLock } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import {
  formatTimeDisplay,
  getISTDayBounds,
  getISTTodayString,
  normalizeHallList,
} from "@sezsec/shared";
import type {
  BridgeEventDto,
  BridgeHallDto,
  BridgeInventoryItemDto,
} from "./bridge.types";

function normalizeHallCounts(raw: unknown): Record<string, number> {
  if (!raw) return {};
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) {
      out[k] = Math.round(n);
    }
  }
  return out;
}

const DEFAULT_DEV_BRIDGE_KEY = "sezsec-internal-bridge-key-2026";

export function verifyBridgeRequest(
  request: Request
): { ok: true } | { ok: false; response: NextResponse } {
  const expectedKey = (
    process.env.SEZSEC_BRIDGE_KEY || DEFAULT_DEV_BRIDGE_KEY
  ).trim();
  const providedKey = (
    request.headers.get("x-sezsec-bridge-key") || ""
  ).trim();

  if (!providedKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Missing bridge authentication key." },
        { status: 401 }
      ),
    };
  }

  const a = Buffer.from(expectedKey, "utf8");
  const b = Buffer.from(providedKey, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid bridge authentication key." },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}

// Deliberately excludes ALL financial/charge fields so sensitive amounts never leave jamatevents
const SAFE_EVENT_SELECT = {
  id: true,
  reference: true,
  name: true,
  mobile: true,
  email: true,
  occasionDate: true,
  occasionDay: true,
  occasionTime: true,
  description: true,
  hall: true,
  catererName: true,
  catererPhone: true,
  decoratorName: true,
  decoratorPhone: true,
  thaalCount: true,
  totalThaalsDone: true,
  sarkariThaalSet: true,
  bhaiSaabIzzan: true,
  muraqebeenIzzan: true,
  benSaabIzzan: true,
  extraChilamchiLota: true,
  tablesAndChairs: true,
  mic: true,
  crockeryRequired: true,
  thaalForDevri: true,
  paat: true,
  masjidLight: true,
  crockeryStatus: true,
  acStartTime: true,
  partyTime: true,
  decorations: true,
  gasCount: true,
  menu: true,
  status: true,
  eventType: true,
  hallCounts: true,
  razaGranted: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EventSelect;

type RawSelectedEvent = Prisma.EventGetPayload<{
  select: typeof SAFE_EVENT_SELECT;
}>;

function toBridgeEventDto(row: RawSelectedEvent): BridgeEventDto {
  const normalizedCounts = normalizeHallCounts(row.hallCounts);
  return {
    id: row.id,
    reference: row.reference,
    name: row.name,
    mobile: row.mobile,
    email: row.email,
    occasionDate: row.occasionDate.toISOString(),
    occasionDay: row.occasionDay,
    occasionTime: row.occasionTime
      ? formatTimeDisplay(row.occasionTime)
      : row.occasionTime,
    description: row.description,
    hall: normalizeHallList(row.hall),
    catererName: row.catererName,
    catererPhone: row.catererPhone,
    decoratorName: row.decoratorName,
    decoratorPhone: row.decoratorPhone,
    thaalCount: row.thaalCount,
    totalThaalsDone: row.totalThaalsDone,
    sarkariThaalSet: row.sarkariThaalSet,
    bhaiSaabIzzan: row.bhaiSaabIzzan,
    muraqebeenIzzan: row.muraqebeenIzzan,
    benSaabIzzan: row.benSaabIzzan,
    extraChilamchiLota: row.extraChilamchiLota,
    tablesAndChairs: row.tablesAndChairs,
    mic: row.mic,
    crockeryRequired: row.crockeryRequired,
    thaalForDevri: row.thaalForDevri,
    paat: row.paat,
    masjidLight: row.masjidLight,
    crockeryStatus: row.crockeryStatus,
    acStartTime: row.acStartTime ? formatTimeDisplay(row.acStartTime) : row.acStartTime,
    partyTime: row.partyTime ? formatTimeDisplay(row.partyTime) : row.partyTime,
    decorations: row.decorations,
    gasCount: row.gasCount,
    menu: row.menu,
    status: row.status,
    eventType: row.eventType,
    hallCounts:
      Object.keys(normalizedCounts).length > 0 ? normalizedCounts : null,
    razaGranted: row.razaGranted,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listBridgeEvents(params: {
  types?: string[];
  excludeCancelled?: boolean;
  from?: string;
  to?: string;
  hasMenu?: boolean;
  ids?: string[];
  limit?: number;
  order?: "asc" | "desc";
}): Promise<BridgeEventDto[]> {
  const where: Prisma.EventWhereInput = {};

  if (params.ids && params.ids.length > 0) {
    where.id = { in: params.ids };
  }

  if (params.types && params.types.length > 0) {
    const validTypes = params.types.filter(
      (t): t is EventType => t === "PUBLIC" || t === "PRIVATE"
    );
    if (validTypes.length > 0) {
      where.eventType = { in: validTypes };
    }
  }

  if (params.excludeCancelled) {
    where.status = { not: "CANCELLED" };
  }

  if (params.from || params.to) {
    where.occasionDate = {};
    if (params.from) {
      const fromDate = new Date(params.from);
      if (!Number.isNaN(fromDate.getTime())) {
        where.occasionDate.gte = fromDate;
      }
    }
    if (params.to) {
      const toDate = new Date(params.to);
      if (!Number.isNaN(toDate.getTime())) {
        where.occasionDate.lte = toDate;
      }
    }
  }

  if (params.hasMenu) {
    where.AND = [{ menu: { not: null } }, { NOT: { menu: "" } }];
  }

  const rows = await db.event.findMany({
    where,
    select: SAFE_EVENT_SELECT,
    orderBy: { occasionDate: params.order === "desc" ? "desc" : "asc" },
    ...(params.limit && params.limit > 0 ? { take: params.limit } : {}),
  });

  return rows.map(toBridgeEventDto);
}

export async function getBridgeEventById(
  id: string
): Promise<BridgeEventDto | null> {
  const row = await db.event.findUnique({
    where: { id },
    select: SAFE_EVENT_SELECT,
  });
  return row ? toBridgeEventDto(row) : null;
}

export async function getBridgeMenuEvent(
  mode: "today" | "upcoming"
): Promise<BridgeEventDto | null> {
  const todayIso = getISTTodayString();
  const { startOfDay: startOfToday, endOfDay: endOfToday } =
    getISTDayBounds(todayIso);

  const row = await db.event.findFirst({
    where: {
      eventType: "PUBLIC",
      status: { not: "CANCELLED" },
      occasionDate:
        mode === "today"
          ? { gte: startOfToday, lte: endOfToday }
          : { gte: startOfToday },
      AND: [{ menu: { not: null } }, { NOT: { menu: "" } }],
    },
    orderBy: { occasionDate: "asc" },
    select: SAFE_EVENT_SELECT,
  });

  return row ? toBridgeEventDto(row) : null;
}

export async function updateBridgeEventThaalsDone(
  eventId: string,
  payload: {
    hallCounts?: Record<string, number>;
    totalOverride?: number;
    actorId?: string;
    actorName?: string;
  }
): Promise<BridgeEventDto | null> {
  const updated = await withWriteLock(() =>
    db.$transaction(async (tx) => {
      const existing = await tx.event.findUnique({
        where: { id: eventId },
        select: { id: true, name: true, totalThaalsDone: true, hallCounts: true },
      });
      if (!existing) return null;

      const mergedCounts = normalizeHallCounts(existing.hallCounts);
      let finalTotal = existing.totalThaalsDone ?? 0;

      if (payload.hallCounts && typeof payload.hallCounts === "object") {
        for (const [hallName, rawCount] of Object.entries(payload.hallCounts)) {
          const safeNum = Math.max(0, Math.round(Number(rawCount) || 0));
          mergedCounts[hallName] = safeNum;
        }
        finalTotal = Object.values(mergedCounts).reduce(
          (sum, val) => sum + (val || 0),
          0
        );
      }

      if (payload.totalOverride !== undefined && payload.totalOverride !== null) {
        finalTotal = Math.max(0, Math.round(Number(payload.totalOverride) || 0));
      }

      return tx.event.update({
        where: { id: eventId },
        data: {
          totalThaalsDone: finalTotal,
          hallCounts: mergedCounts as Prisma.InputJsonValue,
        },
        select: SAFE_EVENT_SELECT,
      });
    })
  );

  if (!updated) return null;

  await recordActivity({
    action: "EVENT_UPDATED",
    summary: `Updated thaals served (${updated.totalThaalsDone ?? 0}) for ${updated.description || updated.name} via Members Portal`,
    userId: payload.actorId || "members-portal",
    userName: payload.actorName || "Members Portal",
    eventId: updated.id,
  });

  return toBridgeEventDto(updated);
}

export async function deleteBridgeEvent(
  eventId: string,
  actor?: { id?: string; name?: string }
): Promise<boolean> {
  const deleted = await withWriteLock(() =>
    db.$transaction(async (tx) => {
      const existing = await tx.event.findUnique({
        where: { id: eventId },
        select: { id: true, name: true, description: true },
      });
      if (!existing) return null;
      await tx.event.delete({ where: { id: eventId } });
      return existing;
    })
  );

  if (!deleted) return false;

  await recordActivity({
    action: "EVENT_DELETED",
    summary: `Deleted booking ${deleted.description || deleted.name} via Members Portal`,
    userId: actor?.id || "members-portal",
    userName: actor?.name || "Members Portal",
    eventId,
  });

  return true;
}

export async function listBridgeHalls(): Promise<BridgeHallDto[]> {
  return db.hall.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      width: true,
      length: true,
    },
  });
}

export async function listBridgeInventory(): Promise<BridgeInventoryItemDto[]> {
  return db.inventoryItem.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      totalQuantity: true,
      availableQuantity: true,
      unit: true,
    },
  });
}
