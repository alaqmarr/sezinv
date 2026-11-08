import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma, type EventType, type Role } from "@/generated/prisma/client";
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

function getBridgeSecretKey(): string {
  return (process.env.SEZSEC_BRIDGE_KEY || DEFAULT_DEV_BRIDGE_KEY).trim();
}

function getInternalSezsecUrl(): string {
  return (process.env.SEZSEC_INTERNAL_URL || "http://127.0.0.1:3334")
    .trim()
    .replace(/\/+$/, "");
}

async function loopbackPostToSezsec(
  path: string,
  payload: unknown
): Promise<void> {
  const primaryBase = getInternalSezsecUrl();
  const candidateBases = [primaryBase];
  if (primaryBase.includes("127.0.0.1")) {
    candidateBases.push(primaryBase.replace("127.0.0.1", "localhost"));
  } else if (primaryBase.includes("localhost")) {
    candidateBases.push(primaryBase.replace("localhost", "127.0.0.1"));
  }

  for (const base of candidateBases) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sezsec-bridge-key": getBridgeSecretKey(),
          "x-sezsec-source": "jamatevents-3333",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok) return;
    } catch {
      // Try next candidate or fail gracefully if companion service is restarting
    }
  }
}

export async function syncUserByIdToSezsec(userId: string): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        moduleAccess: {
          select: { moduleId: true },
        },
      },
    });
    if (!user) return;
    await loopbackPostToSezsec("/api/bridge/users/sync", {
      action: "UPSERT",
      userId: user.id,
      user: {
        id: user.id,
        username: user.username,
        password: user.password,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        its: user.its,
        role: user.role,
        moduleIds: user.moduleAccess.map((m) => m.moduleId),
      },
    });
  } catch {
    // Non-blocking
  }
}

export async function pushUserDeleteToSezsec(
  userId: string,
  username?: string
): Promise<void> {
  await loopbackPostToSezsec("/api/bridge/users/sync", {
    action: "DELETE",
    userId,
    username,
  });
}

export async function pushHallsToSezsec(): Promise<void> {
  try {
    const halls = await listBridgeHalls();
    await loopbackPostToSezsec("/api/bridge/halls/sync", { halls });
  } catch {
    // Non-blocking
  }
}

export async function pushEventChangeToSezsec(payload: {
  action: "UPSERT" | "DELETE";
  eventId: string;
  event?: {
    title?: string;
    occasionDate?: string;
    occasionTime?: string;
    eventType?: string;
    status?: string;
  };
}): Promise<void> {
  await loopbackPostToSezsec("/api/bridge/events/sync", payload);
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

const VALID_SYNC_ROLES = new Set<Role>([
  "ADMIN",
  "ADMIN_CUSTOM",
  "MANAGER",
  "STAFF",
  "WATCHER",
  "USER",
]);

export async function syncBridgeUserAccount(payload: {
  action: "UPSERT" | "DELETE";
  userId: string;
  user?: {
    id: string;
    username: string;
    password: string;
    name: string | null;
    email: string | null;
    mobile: string | null;
    its: string | null;
    role: string;
    moduleIds?: string[];
    modules?: Array<{
      id: string;
      name: string;
      description: string | null;
      icon: string | null;
    }>;
  };
}): Promise<{ ok: true }> {
  await withWriteLock(() =>
    db.$transaction(async (tx) => {
      if (payload.action === "DELETE") {
        const existing = await tx.user.findFirst({
          where: {
            OR: [
              { id: payload.userId },
              ...(payload.user?.username
                ? [{ username: payload.user.username }]
                : []),
            ],
          },
          select: { id: true },
        });
        if (existing) {
          await tx.user.delete({ where: { id: existing.id } });
        }
        return;
      }

      const u = payload.user;
      if (!u || !u.username) return;

      const safeRole: Role = VALID_SYNC_ROLES.has(u.role as Role)
        ? (u.role as Role)
        : "STAFF";

      // Ensure any referenced modules exist locally (e.g. event_charges, hall-*)
      if (Array.isArray(u.modules)) {
        for (const m of u.modules) {
          const byId = await tx.module.findUnique({ where: { id: m.id } });
          const byName = await tx.module.findUnique({ where: { name: m.name } });
          if (!byId && !byName) {
            await tx.module.create({
              data: {
                id: m.id,
                name: m.name,
                description: m.description,
                icon: m.icon,
              },
            });
          }
        }
      }

      const cleanIts = u.its?.trim() || null;
      const byId = await tx.user.findUnique({ where: { id: u.id } });
      const byUsername = await tx.user.findUnique({
        where: { username: u.username },
      });
      const byIts = cleanIts
        ? await tx.user.findUnique({ where: { its: cleanIts } })
        : null;

      const target = byId || byUsername || byIts;
      const safeIts =
        cleanIts && (!byIts || (target && byIts.id === target.id))
          ? cleanIts
          : null;

      let localUserId: string;
      if (target) {
        const canUpdateUsername =
          !byUsername || byUsername.id === target.id;
        const updated = await tx.user.update({
          where: { id: target.id },
          data: {
            ...(canUpdateUsername ? { username: u.username } : {}),
            ...(u.password ? { password: u.password } : {}),
            name: u.name,
            email: u.email,
            mobile: u.mobile,
            its: safeIts,
            role: safeRole,
          },
        });
        localUserId = updated.id;
      } else {
        const created = await tx.user.create({
          data: {
            id: u.id,
            username: u.username,
            password: u.password,
            name: u.name,
            email: u.email,
            mobile: u.mobile,
            its: safeIts,
            role: safeRole,
          },
        });
        localUserId = created.id;
      }

      // Sync shared permission modules (event_charges & hall-* modules) without wiping jamatevents-specific section access
      if (Array.isArray(u.moduleIds)) {
        const syncedSpecialIds = u.moduleIds.filter(
          (id) =>
            id === "event_charges" ||
            id.startsWith("hall-") ||
            id === "view-private-events-sezsecorg" ||
            id === "update-thaal-count-sezsecorg"
        );

        await tx.userModuleAccess.deleteMany({
          where: {
            userId: localUserId,
            OR: [
              { moduleId: "event_charges" },
              { moduleId: { startsWith: "hall-" } },
              { moduleId: "view-private-events-sezsecorg" },
              { moduleId: "update-thaal-count-sezsecorg" },
            ],
          },
        });

            for (const modId of syncedSpecialIds) {
              const exists = await tx.module.findUnique({ where: { id: modId } });
              if (exists) {
                await tx.userModuleAccess.upsert({
                  where: {
                    userId_moduleId: {
                      userId: localUserId,
                      moduleId: modId,
                    },
                  },
                  update: {},
                  create: {
                    userId: localUserId,
                    moduleId: modId,
                  },
                });
              }
            }
          }
        })
      );

  return { ok: true };
}

export async function getBridgeBootstrapCounts(): Promise<
  Record<string, number>
> {
  const [
    users,
    modules,
    module_links,
    user_module_access,
    halls,
    user_fee_configs,
    fee_records,
    fee_transactions,
    event_contributions,
    fee_transaction_allocations,
    floor_configs,
    attendance_event_clones,
    attendance_records,
    member_registrations,
    khidmat_requests,
    blogs,
    banners,
  ] = await Promise.all([
    db.user.count(),
    db.module.count(),
    db.moduleLink.count(),
    db.userModuleAccess.count(),
    db.hall.count(),
    db.userFeeConfig.count(),
    db.feeRecord.count(),
    db.feeTransaction.count(),
    db.eventContribution.count(),
    db.feeTransactionAllocation.count(),
    db.floorConfig.count(),
    db.attendanceEventClone.count(),
    db.attendanceRecord.count(),
    db.memberRegistration.count(),
    db.khidmatRequest.count(),
    db.blog.count(),
    db.banner.count(),
  ]);

  return {
    users,
    modules,
    module_links,
    user_module_access,
    halls,
    user_fee_configs,
    fee_records,
    fee_transactions,
    event_contributions,
    fee_transaction_allocations,
    floor_configs,
    attendance_event_clones,
    attendance_records,
    member_registrations,
    khidmat_requests,
    blogs,
    banners,
  };
}

export async function getBridgeBootstrapSnapshot() {
  const [
    modules,
    moduleLinks,
    users,
    userModuleAccess,
    halls,
    khidmatRequests,
    memberRegistrations,
    blogs,
    banners,
    userFeeConfigs,
    feeRecords,
    feeTransactions,
    eventContributions,
    feeTransactionAllocations,
    floorConfigsRaw,
    attendanceRecords,
    attendanceEventClonesRaw,
  ] = await Promise.all([
    db.module.findMany(),
    db.moduleLink.findMany(),
    db.user.findMany(),
    db.userModuleAccess.findMany(),
    db.hall.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, width: true, length: true },
    }),
    db.khidmatRequest.findMany(),
    db.memberRegistration.findMany(),
    db.blog.findMany(),
    db.banner.findMany(),
    db.userFeeConfig.findMany(),
    db.feeRecord.findMany(),
    db.feeTransaction.findMany(),
    db.eventContribution.findMany(),
    db.feeTransactionAllocation.findMany(),
    db.floorConfig.findMany({
      include: {
        heads: { select: { id: true } },
        subHeads: { select: { id: true } },
        members: { select: { id: true } },
      },
    }),
    db.attendanceRecord.findMany(),
    db.attendanceEventClone.findMany({
      include: {
        event: {
          select: {
            id: true,
            name: true,
            description: true,
            occasionDate: true,
            occasionTime: true,
            eventType: true,
          },
        },
      },
    }),
  ]);

  const floorConfigs = floorConfigsRaw.map((fc) => ({
    id: fc.id,
    name: fc.name,
    createdAt: fc.createdAt.toISOString(),
    updatedAt: fc.updatedAt.toISOString(),
    headIds: fc.heads.map((u) => u.id),
    subHeadIds: fc.subHeads.map((u) => u.id),
    memberIds: fc.members.map((u) => u.id),
  }));

  const attendanceEventClones = attendanceEventClonesRaw.map((aec) => ({
    id: aec.id,
    eventId: aec.eventId,
    isActive: aec.isActive,
    startTime: aec.startTime.toISOString(),
    endTime: aec.endTime.toISOString(),
    createdAt: aec.createdAt.toISOString(),
    eventTitle: aec.event
      ? String(aec.event.description || aec.event.name || "Jamaat Miqaat")
      : null,
    eventDate: aec.event ? aec.event.occasionDate.toISOString() : null,
    eventTime: aec.event?.occasionTime
      ? formatTimeDisplay(aec.event.occasionTime)
      : null,
    eventType: aec.event?.eventType ?? null,
  }));

  return {
    modules,
    moduleLinks,
    users,
    userModuleAccess,
    halls,
    khidmatRequests,
    memberRegistrations,
    blogs,
    banners,
    userFeeConfigs,
    feeRecords,
    feeTransactions,
    eventContributions,
    feeTransactionAllocations,
    floorConfigs,
    attendanceRecords,
    attendanceEventClones,
  };
}

