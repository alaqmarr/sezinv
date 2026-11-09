import { Pool, types as pgTypes, type PoolClient } from "pg";
import {
  Prisma,
  type ApprovalStatus,
  type AttendanceStatus,
  type CrockeryStatus,
  type EventStatus,
  type EventType,
  type FeeStatus,
  type ProfileStatus,
  type Role,
} from "@/generated/prisma/client";
import { db, sqliteAdapterFactory, withWriteLock } from "@sezsec/db";
import { normalizeHallList } from "@sezsec/shared";
import { recordActivity } from "@sezsec/logs";
import { DEFAULT_PORTAL_MODULES } from "@sezsec/rbac/rbac.constants";
import type {
  MigrationPreviewReport,
  MigrationRunResult,
  MigrationTableCount,
} from "./migration.types";

// Prisma stores DateTime in PostgreSQL as TIMESTAMP WITHOUT TIME ZONE (OID 1114) in UTC.
// Override node-postgres's default local-timezone parser so raw UTC strings are never shifted by host timezone!
function parsePgTimestampWithoutTzAsUtc(raw: string): Date {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return new Date(NaN);
  if (/[zZ]|[+-]\d{2}(:?\d{2})?$/.test(trimmed)) {
    return new Date(trimmed.replace(" ", "T"));
  }
  return new Date(`${trimmed.replace(" ", "T")}Z`);
}

pgTypes.setTypeParser(1114, parsePgTimestampWithoutTzAsUtc);
pgTypes.setTypeParser(
  1082,
  (raw: string) => new Date(`${String(raw).trim()}T00:00:00.000Z`)
);

const PLACEHOLDER_STARTER_HALL_NAMES = [
  "Main Jamaat Khana Hall",
  "Ground Floor Dining Hall",
  "First Floor Hall",
  "Open Sahan / Courtyard",
];

const VALID_ROLES = new Set<Role>([
  "ADMIN",
  "ADMIN_CUSTOM",
  "MANAGER",
  "STAFF",
  "WATCHER",
  "USER",
]);
const VALID_PROFILE_STATUS = new Set<ProfileStatus>(["COMPLETED", "SKIPPED"]);
const VALID_EVENT_STATUS = new Set<EventStatus>([
  "BOOKED",
  "CANCELLED",
  "COMPLETED",
]);
const VALID_EVENT_TYPES = new Set<EventType>(["PUBLIC", "PRIVATE"]);
const VALID_CROCKERY_STATUS = new Set<CrockeryStatus>([
  "PENDING",
  "NOT_REQUIRED",
  "COMPLETED",
]);
const VALID_APPROVAL_STATUS = new Set<ApprovalStatus>([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);
const VALID_FEE_STATUS = new Set<FeeStatus>(["PENDING", "PARTIAL", "PAID"]);
const VALID_ATTENDANCE_STATUS = new Set<AttendanceStatus>([
  "PRESENT",
  "ABSENT",
  "EXCUSED",
]);

function coerceRole(val: unknown): Role {
  const s = String(val || "").toUpperCase() as Role;
  return VALID_ROLES.has(s) ? s : "STAFF";
}

function coerceProfileStatus(val: unknown): ProfileStatus | null {
  if (!val) return null;
  const s = String(val).toUpperCase() as ProfileStatus;
  return VALID_PROFILE_STATUS.has(s) ? s : null;
}

function coerceEventStatus(val: unknown): EventStatus {
  const s = String(val || "").toUpperCase() as EventStatus;
  return VALID_EVENT_STATUS.has(s) ? s : "BOOKED";
}

function coerceEventType(val: unknown): EventType {
  const s = String(val || "").toUpperCase() as EventType;
  return VALID_EVENT_TYPES.has(s) ? s : "PRIVATE";
}

function coerceCrockeryStatus(val: unknown): CrockeryStatus {
  const s = String(val || "").toUpperCase() as CrockeryStatus;
  return VALID_CROCKERY_STATUS.has(s) ? s : "NOT_REQUIRED";
}

function coerceApprovalStatus(val: unknown): ApprovalStatus {
  const s = String(val || "").toUpperCase() as ApprovalStatus;
  return VALID_APPROVAL_STATUS.has(s) ? s : "PENDING";
}

function coerceFeeStatus(val: unknown): FeeStatus {
  const s = String(val || "").toUpperCase() as FeeStatus;
  return VALID_FEE_STATUS.has(s) ? s : "PENDING";
}

function coerceAttendanceStatus(val: unknown): AttendanceStatus {
  const s = String(val || "").toUpperCase() as AttendanceStatus;
  return VALID_ATTENDANCE_STATUS.has(s) ? s : "PRESENT";
}

function cleanNullableUnique(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = String(val).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNeonConnectionUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.searchParams.delete("sslmode");
    parsed.searchParams.delete("channel_binding");
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const TABLE_DEFINITIONS: Array<{
  table: string;
  label: string;
  group: "Events & Store" | "Shared Jamaat Portal";
  countSqlite: () => Promise<number>;
}> = [
  { table: "users", label: "Team & Member Accounts", group: "Events & Store", countSqlite: () => db.user.count() },
  { table: "halls", label: "Halls & Venues", group: "Events & Store", countSqlite: () => db.hall.count() },
  { table: "caterers", label: "Caterers Directory", group: "Events & Store", countSqlite: () => db.caterer.count() },
  { table: "inventory_items", label: "Store Vessel Items", group: "Events & Store", countSqlite: () => db.inventoryItem.count() },
  { table: "events", label: "Hall Bookings & Events", group: "Events & Store", countSqlite: () => db.event.count() },
  { table: "event_inventory", label: "Issued / Returned Items", group: "Events & Store", countSqlite: () => db.eventInventory.count() },
  { table: "floor_item_types", label: "Floor Layout Shapes", group: "Events & Store", countSqlite: () => db.floorItemType.count() },
  { table: "floor_plans", label: "Saved Floor Layouts", group: "Events & Store", countSqlite: () => db.floorPlan.count() },
  { table: "config", label: "Office Settings", group: "Events & Store", countSqlite: () => db.config.count() },
  { table: "modules", label: "Portal Access Sections", group: "Shared Jamaat Portal", countSqlite: () => db.module.count() },
  { table: "module_links", label: "Portal Section Links", group: "Shared Jamaat Portal", countSqlite: () => db.moduleLink.count() },
  { table: "user_module_access", label: "Member Section Permissions", group: "Shared Jamaat Portal", countSqlite: () => db.userModuleAccess.count() },
  { table: "khidmat_requests", label: "Khidmat Requests", group: "Shared Jamaat Portal", countSqlite: () => db.khidmatRequest.count() },
  { table: "member_registrations", label: "Member Registrations", group: "Shared Jamaat Portal", countSqlite: () => db.memberRegistration.count() },
  { table: "blogs", label: "Articles & Posts", group: "Shared Jamaat Portal", countSqlite: () => db.blog.count() },
  { table: "banners", label: "Portal Banners", group: "Shared Jamaat Portal", countSqlite: () => db.banner.count() },
  { table: "user_fee_configs", label: "Member Fee Setup", group: "Shared Jamaat Portal", countSqlite: () => db.userFeeConfig.count() },
  { table: "fee_records", label: "Monthly Fee Records", group: "Shared Jamaat Portal", countSqlite: () => db.feeRecord.count() },
  { table: "fee_transactions", label: "Fee Payments", group: "Shared Jamaat Portal", countSqlite: () => db.feeTransaction.count() },
  { table: "event_contributions", label: "Event Contributions", group: "Shared Jamaat Portal", countSqlite: () => db.eventContribution.count() },
  { table: "fee_transaction_allocations", label: "Fee Payment Allocations", group: "Shared Jamaat Portal", countSqlite: () => db.feeTransactionAllocation.count() },
  { table: "floor_configs", label: "Attendance Floor Groups", group: "Shared Jamaat Portal", countSqlite: () => db.floorConfig.count() },
  { table: "attendance_records", label: "Attendance Entries", group: "Shared Jamaat Portal", countSqlite: () => db.attendanceRecord.count() },
  { table: "attendance_event_clones", label: "Attendance Sessions", group: "Shared Jamaat Portal", countSqlite: () => db.attendanceEventClone.count() },
];

/**
 * Opens a strictly READ-ONLY PostgreSQL transaction on Neon.
 * Guarantees at the PostgreSQL protocol level that zero writes can ever occur on Neon.
 */
async function withReadOnlyNeonClient<T>(
  connectionUrl: string,
  fn: (client: PoolClient, existingTables: Set<string>) => Promise<T>
): Promise<T> {
  const pool = new Pool({
    connectionString: normalizeNeonConnectionUrl(connectionUrl),
    max: 1,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    await client.query("SET TIME ZONE 'UTC';");
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;");
    await client.query("BEGIN READ ONLY;");

    const tablesRes = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const existingTables = new Set(tablesRes.rows.map((r) => r.table_name));

    const result = await fn(client, existingTables);
    await client.query("ROLLBACK;");
    return result;
  } finally {
    client.release();
    await pool.end().catch(() => null);
  }
}

function toDate(val: unknown, fallback: Date = new Date()): Date {
  if (!val) return fallback;
  if (val instanceof Date) return val;
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function toNullableDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getLocalMigrationBaselineReport(): Promise<MigrationPreviewReport> {
  const neonConfigured = Boolean(
    (process.env.NEON_DATABASE_URL || "").trim()
  );
  const sqliteCounts = await Promise.all(
    TABLE_DEFINITIONS.map((t) => t.countSqlite())
  );
  const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map((def, idx) => ({
    table: def.table,
    label: def.label,
    group: def.group,
    neonCount: 0,
    sqliteCount: sqliteCounts[idx],
  }));

  return {
    neonConfigured,
    neonReachable: false,
    onlineChecked: !neonConfigured,
    error: neonConfigured
      ? undefined
      : "Previous database connection URL (NEON_DATABASE_URL) is not set in .env.",
    tables,
    totalNeonRows: 0,
    totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
  };
}

export async function inspectNeonVsSqliteCounts(
  customNeonUrl?: string
): Promise<MigrationPreviewReport> {
  const neonUrl = (customNeonUrl || process.env.NEON_DATABASE_URL || "").trim();

  const sqliteCounts = await Promise.all(
    TABLE_DEFINITIONS.map((t) => t.countSqlite())
  );

  if (!neonUrl) {
    const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map((def, idx) => ({
      table: def.table,
      label: def.label,
      group: def.group,
      neonCount: 0,
      sqliteCount: sqliteCounts[idx],
    }));
    return {
      neonConfigured: false,
      neonReachable: false,
      onlineChecked: true,
      error: "Previous database connection URL (NEON_DATABASE_URL) is not set in .env.",
      tables,
      totalNeonRows: 0,
      totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
    };
  }

  try {
    const neonCountMap = await withReadOnlyNeonClient(
      neonUrl,
      async (client, existingTables) => {
        const counts: Record<string, number> = {};
        for (const def of TABLE_DEFINITIONS) {
          if (!existingTables.has(def.table)) {
            counts[def.table] = 0;
            continue;
          }
          const res = await client.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM "${def.table}"`
          );
          counts[def.table] = parseInt(res.rows[0]?.cnt || "0", 10);
        }
        return counts;
      }
    );

    const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map((def, idx) => ({
      table: def.table,
      label: def.label,
      group: def.group,
      neonCount: neonCountMap[def.table] ?? 0,
      sqliteCount: sqliteCounts[idx],
    }));

    return {
      neonConfigured: true,
      neonReachable: true,
      onlineChecked: true,
      tables,
      totalNeonRows: Object.values(neonCountMap).reduce((a, b) => a + b, 0),
      totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
    };
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : "Could not connect to the previous database.";
    const tables: MigrationTableCount[] = TABLE_DEFINITIONS.map((def, idx) => ({
      table: def.table,
      label: def.label,
      group: def.group,
      neonCount: 0,
      sqliteCount: sqliteCounts[idx],
    }));
    return {
      neonConfigured: true,
      neonReachable: false,
      onlineChecked: true,
      error: msg,
      tables,
      totalNeonRows: 0,
      totalSqliteRows: sqliteCounts.reduce((a, b) => a + b, 0),
    };
  }
}

export async function runOneClickNeonToSqliteMigration(params: {
  actor: { id: string; name: string };
  customNeonUrl?: string;
}): Promise<MigrationRunResult> {
  const startedAt = performance.now();
  const neonUrl = (
    params.customNeonUrl ||
    process.env.NEON_DATABASE_URL ||
    ""
  ).trim();

  if (!neonUrl) {
    throw new Error(
      "Previous database connection URL (NEON_DATABASE_URL) is missing."
    );
  }

  const importedByTable: Record<string, number> = {};
  const warnings: string[] = [];

  // Step 1: Read all data from Neon inside a strictly READ-ONLY session
  const snapshot = await withReadOnlyNeonClient(
    neonUrl,
    async (client, existingTables) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectAll = async (tableName: string): Promise<any[]> => {
        if (!existingTables.has(tableName)) return [];
        const res = await client.query(`SELECT * FROM "${tableName}"`);
        return res.rows;
      };

      return {
        modules: await selectAll("modules"),
        moduleLinks: await selectAll("module_links"),
        users: await selectAll("users"),
        userModuleAccess: await selectAll("user_module_access"),
        halls: await selectAll("halls"),
        caterers: await selectAll("caterers"),
        inventoryItems: await selectAll("inventory_items"),
        floorItemTypes: await selectAll("floor_item_types"),
        floorPlans: await selectAll("floor_plans"),
        config: await selectAll("config"),
        events: await selectAll("events"),
        eventInventory: await selectAll("event_inventory"),
        khidmatRequests: await selectAll("khidmat_requests"),
        memberRegistrations: await selectAll("member_registrations"),
        blogs: await selectAll("blogs"),
        banners: await selectAll("banners"),
        userFeeConfigs: await selectAll("user_fee_configs"),
        feeRecords: await selectAll("fee_records"),
        feeTransactions: await selectAll("fee_transactions"),
        eventContributions: await selectAll("event_contributions"),
        feeTransactionAllocations: await selectAll("fee_transaction_allocations"),
        floorConfigs: await selectAll("floor_configs"),
        floorHeadsJoin: await selectAll("_FloorHeads"),
        floorSubHeadsJoin: await selectAll("_FloorSubHeads"),
        floorMembersJoin: await selectAll("_FloorMembers"),
        attendanceRecords: await selectAll("attendance_records"),
        attendanceEventClones: await selectAll("attendance_event_clones"),
      };
    }
  );

  // Step 2: Upsert into local SQLite in relational dependency order
  await withWriteLock(() =>
    db.$transaction(
      async (tx) => {
      // 1. Modules & Module Links
      const moduleIdMap = new Map<string, string>();
      for (const m of snapshot.modules) {
        const byId = await tx.module.findUnique({ where: { id: m.id } });
        const byName = await tx.module.findUnique({ where: { name: m.name } });

        if (byId) {
          await tx.module.update({
            where: { id: byId.id },
            data: {
              ...(byName && byName.id !== byId.id ? {} : { name: m.name }),
              description: m.description ?? null,
              icon: m.icon ?? null,
            },
          });
          moduleIdMap.set(m.id, byId.id);
        } else if (byName) {
          await tx.module.update({
            where: { id: byName.id },
            data: {
              description: m.description ?? null,
              icon: m.icon ?? null,
            },
          });
          moduleIdMap.set(m.id, byName.id);
        } else {
          const created = await tx.module.create({
            data: {
              id: m.id,
              name: m.name,
              description: m.description ?? null,
              icon: m.icon ?? null,
              createdAt: toDate(m.createdAt),
            },
          });
          moduleIdMap.set(m.id, created.id);
        }
      }
      for (const defMod of DEFAULT_PORTAL_MODULES) {
        const existingById = await tx.module.findUnique({
          where: { id: defMod.id },
        });
        const existingByName = await tx.module.findUnique({
          where: { name: defMod.name },
        });
        if (!existingById && !existingByName) {
          await tx.module.create({
            data: {
              id: defMod.id,
              name: defMod.name,
              description: defMod.description,
              icon: defMod.icon,
            },
          });
        }
      }
      importedByTable.modules = snapshot.modules.length;

      let mlCount = 0;
      for (const ml of snapshot.moduleLinks) {
        const mappedModuleId = moduleIdMap.get(ml.moduleId);
        if (!mappedModuleId) continue;
        await tx.moduleLink.upsert({
          where: { id: ml.id },
          update: {
            moduleId: mappedModuleId,
            path: ml.path,
            label: ml.label ?? null,
            order: Number(ml.order ?? 0),
          },
          create: {
            id: ml.id,
            moduleId: mappedModuleId,
            path: ml.path,
            label: ml.label ?? null,
            order: Number(ml.order ?? 0),
          },
        });
        mlCount += 1;
      }
      importedByTable.module_links = mlCount;

      // 2. Users (Pass 1: without self-referential headedById; Pass 2: link headedById)
      const userIdMap = new Map<string, string>();
      const existingUsers = await tx.user.findMany({
        select: { id: true, username: true, its: true },
      });
      const idToUser = new Map(existingUsers.map((x) => [x.id, x]));
      const usernameToId = new Map(existingUsers.map((x) => [x.username, x.id]));
      const itsToId = new Map<string, string>();
      for (const ex of existingUsers) {
        if (ex.its) itsToId.set(ex.its, ex.id);
      }

      for (const u of snapshot.users) {
        const cleanUsername = String(u.username || "").trim();
        if (!cleanUsername) continue;
        const rawIts = cleanNullableUnique(u.its);

        const matchId =
          (idToUser.has(u.id) ? u.id : undefined) ||
          usernameToId.get(cleanUsername) ||
          (rawIts ? itsToId.get(rawIts) : undefined);

        const safeIts =
          rawIts && (!itsToId.has(rawIts) || itsToId.get(rawIts) === (matchId || u.id))
            ? rawIts
            : null;

        if (rawIts && !safeIts) {
          warnings.push(`Skipped duplicate ITS "${rawIts}" on user ${cleanUsername}.`);
        }

        if (matchId) {
          const canUpdateUsername =
            !usernameToId.has(cleanUsername) ||
            usernameToId.get(cleanUsername) === matchId;

          await tx.user.update({
            where: { id: matchId },
            data: {
              ...(canUpdateUsername ? { username: cleanUsername } : {}),
              password: String(u.password || ""),
              email: u.email ?? null,
              mobile: u.mobile ?? null,
              name: u.name ?? null,
              role: coerceRole(u.role),
              profileStatus: coerceProfileStatus(u.profileStatus),
              dob: toNullableDate(u.dob),
              quranHifz: u.quranHifz ?? null,
              passport: u.passport ?? null,
              kunSafar: u.kunSafar ?? null,
              occupation: u.occupation ?? null,
              sports: u.sports ?? null,
              its: safeIts,
            },
          });
          userIdMap.set(u.id, matchId);
          if (canUpdateUsername) usernameToId.set(cleanUsername, matchId);
          if (safeIts) itsToId.set(safeIts, matchId);
        } else {
          const created = await tx.user.create({
            data: {
              id: u.id,
              username: cleanUsername,
              password: String(u.password || ""),
              email: u.email ?? null,
              mobile: u.mobile ?? null,
              name: u.name ?? null,
              role: coerceRole(u.role),
              profileStatus: coerceProfileStatus(u.profileStatus),
              dob: toNullableDate(u.dob),
              quranHifz: u.quranHifz ?? null,
              passport: u.passport ?? null,
              kunSafar: u.kunSafar ?? null,
              occupation: u.occupation ?? null,
              sports: u.sports ?? null,
              its: safeIts,
              createdAt: toDate(u.createdAt),
              updatedAt: toDate(u.updatedAt),
            },
          });
          userIdMap.set(u.id, created.id);
          idToUser.set(created.id, {
            id: created.id,
            username: cleanUsername,
            its: safeIts,
          });
          usernameToId.set(cleanUsername, created.id);
          if (safeIts) itsToId.set(safeIts, created.id);
        }
      }

      for (const u of snapshot.users) {
        const selfId = userIdMap.get(u.id);
        const headId = u.headedById ? userIdMap.get(u.headedById) : undefined;
        if (selfId && headId) {
          await tx.user.update({
            where: { id: selfId },
            data: { headedById: headId },
          });
        }
      }
      importedByTable.users = snapshot.users.length;

      // 3. User Module Access
      let umaCount = 0;
      for (const uma of snapshot.userModuleAccess) {
        const uid = userIdMap.get(uma.userId);
        const mid = moduleIdMap.get(uma.moduleId);
        if (!uid || !mid) continue;

        const existingUma = await tx.userModuleAccess.findUnique({
          where: { userId_moduleId: { userId: uid, moduleId: mid } },
        });
        if (!existingUma) {
          const idTaken = await tx.userModuleAccess.findUnique({
            where: { id: uma.id },
          });
          await tx.userModuleAccess.create({
            data: {
              ...(idTaken ? {} : { id: uma.id }),
              userId: uid,
              moduleId: mid,
              createdAt: toDate(uma.createdAt),
            },
          });
        }
        umaCount += 1;
      }
      importedByTable.user_module_access = umaCount;

      // 4. Halls, Caterers, Inventory Items, Floor Item Types, Floor Plans, Config
      if (snapshot.halls.length > 0) {
        const neonHallNames = new Set(snapshot.halls.map((h) => String(h.name)));
        const staleStarters = PLACEHOLDER_STARTER_HALL_NAMES.filter(
          (n) => !neonHallNames.has(n)
        );
        if (staleStarters.length > 0) {
          await tx.hall.deleteMany({
            where: {
              name: { in: staleStarters },
              floorPlans: { none: {} },
            },
          });
        }
      }

      const hallIdMap = new Map<string, string>();
      for (const h of snapshot.halls) {
        const width =
          h.width !== null && h.width !== undefined ? Number(h.width) : null;
        const length =
          h.length !== null && h.length !== undefined ? Number(h.length) : null;

        const byId = await tx.hall.findUnique({ where: { id: h.id } });
        const byName = await tx.hall.findUnique({ where: { name: h.name } });

        if (byId) {
          await tx.hall.update({
            where: { id: byId.id },
            data: {
              ...(byName && byName.id !== byId.id ? {} : { name: h.name }),
              width,
              length,
            },
          });
          hallIdMap.set(h.id, byId.id);
        } else if (byName) {
          await tx.hall.update({
            where: { id: byName.id },
            data: { width, length },
          });
          hallIdMap.set(h.id, byName.id);
        } else {
          const created = await tx.hall.create({
            data: { id: h.id, name: h.name, width, length },
          });
          hallIdMap.set(h.id, created.id);
        }
      }
      importedByTable.halls = snapshot.halls.length;

      const catererIdMap = new Map<string, string>();
      for (const c of snapshot.caterers) {
        const byId = await tx.caterer.findUnique({ where: { id: c.id } });
        const byName = await tx.caterer.findUnique({ where: { name: c.name } });

        if (byId) {
          await tx.caterer.update({
            where: { id: byId.id },
            data: {
              ...(byName && byName.id !== byId.id ? {} : { name: c.name }),
              phone: c.phone || "",
            },
          });
          catererIdMap.set(c.id, byId.id);
        } else if (byName) {
          await tx.caterer.update({
            where: { id: byName.id },
            data: { phone: c.phone || "" },
          });
          catererIdMap.set(c.id, byName.id);
        } else {
          const created = await tx.caterer.create({
            data: {
              id: c.id,
              name: c.name,
              phone: c.phone || "",
            },
          });
          catererIdMap.set(c.id, created.id);
        }
      }
      importedByTable.caterers = snapshot.caterers.length;

      const validItemIds = new Set<string>();
      for (const item of snapshot.inventoryItems) {
        await tx.inventoryItem.upsert({
          where: { id: item.id },
          update: {
            name: item.name,
            category: item.category || "General",
            totalQuantity: Number(item.totalQuantity ?? 0),
            availableQuantity: Number(item.availableQuantity ?? 0),
            unit: item.unit || "pcs",
          },
          create: {
            id: item.id,
            name: item.name,
            category: item.category || "General",
            totalQuantity: Number(item.totalQuantity ?? 0),
            availableQuantity: Number(item.availableQuantity ?? 0),
            unit: item.unit || "pcs",
            createdAt: toDate(item.createdAt),
            updatedAt: toDate(item.updatedAt),
          },
        });
        validItemIds.add(item.id);
      }
      importedByTable.inventory_items = snapshot.inventoryItems.length;

      for (const fit of snapshot.floorItemTypes) {
        await tx.floorItemType.upsert({
          where: { id: fit.id },
          update: {
            name: fit.name,
            type: fit.type,
            width: Number(fit.width ?? 4),
            length: Number(fit.length ?? 4),
            color: fit.color ?? null,
            icon: fit.icon ?? null,
          },
          create: {
            id: fit.id,
            name: fit.name,
            type: fit.type,
            width: Number(fit.width ?? 4),
            length: Number(fit.length ?? 4),
            color: fit.color ?? null,
            icon: fit.icon ?? null,
            createdAt: toDate(fit.createdAt),
          },
        });
      }
      importedByTable.floor_item_types = snapshot.floorItemTypes.length;

      const existingTokens = new Map<string, string>();
      for (const row of await tx.floorPlan.findMany({
        select: { id: true, publicToken: true },
      })) {
        if (row.publicToken) existingTokens.set(row.publicToken, row.id);
      }

      let fpCount = 0;
      for (const fp of snapshot.floorPlans) {
        const mappedHallId = hallIdMap.get(fp.hallId);
        if (!mappedHallId) continue;

        const rawToken = cleanNullableUnique(fp.publicToken);
        const safeToken =
          rawToken &&
          (!existingTokens.has(rawToken) || existingTokens.get(rawToken) === fp.id)
            ? rawToken
            : null;

        await tx.floorPlan.upsert({
          where: { id: fp.id },
          update: {
            name: fp.name,
            hallId: mappedHallId,
            data: (fp.data || []) as Prisma.InputJsonValue,
            width: Number(fp.width ?? 40),
            length: Number(fp.length ?? 60),
            isPublic: Boolean(fp.isPublic),
            publicToken: safeToken,
          },
          create: {
            id: fp.id,
            name: fp.name,
            hallId: mappedHallId,
            data: (fp.data || []) as Prisma.InputJsonValue,
            width: Number(fp.width ?? 40),
            length: Number(fp.length ?? 60),
            isPublic: Boolean(fp.isPublic),
            publicToken: safeToken,
            createdAt: toDate(fp.createdAt),
            updatedAt: toDate(fp.updatedAt),
          },
        });
        if (safeToken) existingTokens.set(safeToken, fp.id);
        fpCount += 1;
      }
      importedByTable.floor_plans = fpCount;

      for (const cfg of snapshot.config) {
        if (cfg.key === "smtpEmail" || cfg.key === "smtpPassword") continue;
        const existingCfg = await tx.config.findUnique({
          where: { key: cfg.key },
        });
        if (existingCfg) {
          await tx.config.update({
            where: { key: cfg.key },
            data: { value: String(cfg.value ?? "") },
          });
        } else {
          const idTaken = await tx.config.findUnique({ where: { id: cfg.id } });
          await tx.config.create({
            data: {
              ...(idTaken ? {} : { id: cfg.id }),
              key: cfg.key,
              value: String(cfg.value ?? ""),
            },
          });
        }
      }
      importedByTable.config = snapshot.config.length;

      // 5. Events & Event Inventory
      const existingRefs = new Map<string, string>();
      for (const row of await tx.event.findMany({
        select: { id: true, reference: true },
      })) {
        if (row.reference) existingRefs.set(row.reference, row.id);
      }

      const validEventIds = new Set<string>();
      for (const ev of snapshot.events) {
        const hallsJson = normalizeHallList(ev.hall) as Prisma.InputJsonValue;
        const safeCreatorId = ev.createdById
          ? (userIdMap.get(ev.createdById) ?? null)
          : null;
        const safeCatererId = ev.catererId
          ? (catererIdMap.get(ev.catererId) ?? null)
          : null;

        const rawRef = cleanNullableUnique(ev.reference);
        const safeRef =
          rawRef &&
          (!existingRefs.has(rawRef) || existingRefs.get(rawRef) === ev.id)
            ? rawRef
            : null;

        await tx.event.upsert({
          where: { id: ev.id },
          update: {
            reference: safeRef,
            name: ev.name,
            mobile: ev.mobile,
            email: ev.email ?? null,
            occasionDate: toDate(ev.occasionDate),
            occasionDay: ev.occasionDay ?? null,
            occasionTime: ev.occasionTime || "12:00 PM",
            description: ev.description || "",
            hall: hallsJson,
            catererName: ev.catererName || "Self",
            catererPhone: ev.catererPhone || "",
            catererId: safeCatererId,
            thaalCount: Number(ev.thaalCount ?? 0),
            totalThaalsDone:
              ev.totalThaalsDone !== null && ev.totalThaalsDone !== undefined
                ? Number(ev.totalThaalsDone)
                : null,
            sarkariThaalSet: Number(ev.sarkariThaalSet ?? 0),
            bhaiSaabIzzan: Boolean(ev.bhaiSaabIzzan),
            muraqebeenIzzan: Boolean(ev.muraqebeenIzzan),
            benSaabIzzan: Boolean(ev.benSaabIzzan),
            extraChilamchiLota: Number(ev.extraChilamchiLota ?? 0),
            tablesAndChairs: Number(ev.tablesAndChairs ?? 0),
            mic: Boolean(ev.mic),
            crockeryRequired: Boolean(ev.crockeryRequired),
            thaalForDevri: Boolean(ev.thaalForDevri),
            paat: Boolean(ev.paat),
            masjidLight: Boolean(ev.masjidLight),
            crockeryStatus: coerceCrockeryStatus(ev.crockeryStatus),
            acStartTime: ev.acStartTime ?? null,
            partyTime: ev.partyTime ?? null,
            decorations: Boolean(ev.decorations),
            gasCount:
              ev.gasCount !== null && ev.gasCount !== undefined
                ? Number(ev.gasCount)
                : null,
            menu: ev.menu ?? null,
            status: coerceEventStatus(ev.status),
            eventType: coerceEventType(ev.eventType),
            hallCounts: ev.hallCounts
              ? (ev.hallCounts as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            paymentMode: ev.paymentMode ?? null,
            transactionId: ev.transactionId ?? null,
            razaGranted: Boolean(ev.razaGranted),
            refundedDate: toNullableDate(ev.refundedDate),
            createdById: safeCreatorId,
            createdAt: toDate(ev.createdAt),
          },
          create: {
            id: ev.id,
            reference: safeRef,
            name: ev.name,
            mobile: ev.mobile,
            email: ev.email ?? null,
            occasionDate: toDate(ev.occasionDate),
            occasionDay: ev.occasionDay ?? null,
            occasionTime: ev.occasionTime || "12:00 PM",
            description: ev.description || "",
            hall: hallsJson,
            catererName: ev.catererName || "Self",
            catererPhone: ev.catererPhone || "",
            catererId: safeCatererId,
            thaalCount: Number(ev.thaalCount ?? 0),
            totalThaalsDone:
              ev.totalThaalsDone !== null && ev.totalThaalsDone !== undefined
                ? Number(ev.totalThaalsDone)
                : null,
            sarkariThaalSet: Number(ev.sarkariThaalSet ?? 0),
            bhaiSaabIzzan: Boolean(ev.bhaiSaabIzzan),
            muraqebeenIzzan: Boolean(ev.muraqebeenIzzan),
            benSaabIzzan: Boolean(ev.benSaabIzzan),
            extraChilamchiLota: Number(ev.extraChilamchiLota ?? 0),
            tablesAndChairs: Number(ev.tablesAndChairs ?? 0),
            mic: Boolean(ev.mic),
            crockeryRequired: Boolean(ev.crockeryRequired),
            thaalForDevri: Boolean(ev.thaalForDevri),
            paat: Boolean(ev.paat),
            masjidLight: Boolean(ev.masjidLight),
            crockeryStatus: coerceCrockeryStatus(ev.crockeryStatus),
            acStartTime: ev.acStartTime ?? null,
            partyTime: ev.partyTime ?? null,
            decorations: Boolean(ev.decorations),
            gasCount:
              ev.gasCount !== null && ev.gasCount !== undefined
                ? Number(ev.gasCount)
                : null,
            menu: ev.menu ?? null,
            status: coerceEventStatus(ev.status),
            eventType: coerceEventType(ev.eventType),
            hallCounts: ev.hallCounts
              ? (ev.hallCounts as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            paymentMode: ev.paymentMode ?? null,
            transactionId: ev.transactionId ?? null,
            razaGranted: Boolean(ev.razaGranted),
            refundedDate: toNullableDate(ev.refundedDate),
            createdById: safeCreatorId,
            createdAt: toDate(ev.createdAt),
            updatedAt: toDate(ev.updatedAt),
          },
        });
        if (safeRef) existingRefs.set(safeRef, ev.id);
        validEventIds.add(ev.id);
      }
      importedByTable.events = snapshot.events.length;

      let eiCount = 0;
      for (const ei of snapshot.eventInventory) {
        if (!validEventIds.has(ei.eventId) || !validItemIds.has(ei.itemId)) {
          continue;
        }
        await tx.eventInventory.upsert({
          where: {
            eventId_itemId: {
              eventId: ei.eventId,
              itemId: ei.itemId,
            },
          },
          update: {
            issuedQty: Number(ei.issuedQty ?? 0),
            returnedQty: Number(ei.returnedQty ?? 0),
            lostQty: Number(ei.lostQty ?? 0),
            recoveredQty: Number(ei.recoveredQty ?? 0),
          },
          create: {
            id: ei.id,
            eventId: ei.eventId,
            itemId: ei.itemId,
            issuedQty: Number(ei.issuedQty ?? 0),
            returnedQty: Number(ei.returnedQty ?? 0),
            lostQty: Number(ei.lostQty ?? 0),
            recoveredQty: Number(ei.recoveredQty ?? 0),
            createdAt: toDate(ei.createdAt),
            updatedAt: toDate(ei.updatedAt),
          },
        });
        eiCount += 1;
      }
      importedByTable.event_inventory = eiCount;

      // 6. Shared Companion Website Tables (Retained 100%)
      for (const kr of snapshot.khidmatRequests) {
        await tx.khidmatRequest.upsert({
          where: { id: kr.id },
          update: {
            miqat: kr.miqat,
            name: kr.name,
            phone: kr.phone,
            date: toDate(kr.date),
            status: coerceApprovalStatus(kr.status),
          },
          create: {
            id: kr.id,
            miqat: kr.miqat,
            name: kr.name,
            phone: kr.phone,
            date: toDate(kr.date),
            status: coerceApprovalStatus(kr.status),
            createdAt: toDate(kr.createdAt),
            updatedAt: toDate(kr.updatedAt),
          },
        });
      }
      importedByTable.khidmat_requests = snapshot.khidmatRequests.length;

      for (const mr of snapshot.memberRegistrations) {
        const byId = await tx.memberRegistration.findUnique({
          where: { id: mr.id },
        });
        const byIts = mr.its
          ? await tx.memberRegistration.findUnique({ where: { its: mr.its } })
          : null;
        const targetMr = byId || byIts;

        const mrData = {
          title: mr.title || "",
          name: mr.name,
          its: mr.its,
          email: mr.email || "",
          dob: toDate(mr.dob),
          phone: mr.phone || "",
          quranHifz: mr.quranHifz || "",
          passport: mr.passport || "",
          kunSafar: mr.kunSafar || "",
          occupation: mr.occupation || "",
          sports: mr.sports || "",
          status: coerceApprovalStatus(mr.status),
        };

        if (targetMr) {
          await tx.memberRegistration.update({
            where: { id: targetMr.id },
            data: mrData,
          });
        } else {
          await tx.memberRegistration.create({
            data: {
              id: mr.id,
              ...mrData,
              createdAt: toDate(mr.createdAt),
              updatedAt: toDate(mr.updatedAt),
            },
          });
        }
      }
      importedByTable.member_registrations = snapshot.memberRegistrations.length;

      for (const b of snapshot.blogs) {
        await tx.blog.upsert({
          where: { id: b.id },
          update: {
            title: b.title,
            content: b.content || "",
            author: b.author || "",
            publishedAt: toDate(b.publishedAt),
          },
          create: {
            id: b.id,
            title: b.title,
            content: b.content || "",
            author: b.author || "",
            publishedAt: toDate(b.publishedAt),
            createdAt: toDate(b.createdAt),
            updatedAt: toDate(b.updatedAt),
          },
        });
      }
      importedByTable.blogs = snapshot.blogs.length;

      for (const bn of snapshot.banners) {
        await tx.banner.upsert({
          where: { id: bn.id },
          update: {
            imageUrl: bn.imageUrl,
            href: bn.href ?? null,
            isActive: Boolean(bn.isActive),
            countdownTarget: toNullableDate(bn.countdownTarget),
            countdownLabel: bn.countdownLabel ?? null,
            x: bn.x !== null && bn.x !== undefined ? Number(bn.x) : 50,
            y: bn.y !== null && bn.y !== undefined ? Number(bn.y) : 50,
            countdownSize: bn.countdownSize ?? "normal",
            countdownColor: bn.countdownColor ?? "gold",
          },
          create: {
            id: bn.id,
            imageUrl: bn.imageUrl,
            href: bn.href ?? null,
            isActive: Boolean(bn.isActive),
            countdownTarget: toNullableDate(bn.countdownTarget),
            countdownLabel: bn.countdownLabel ?? null,
            x: bn.x !== null && bn.x !== undefined ? Number(bn.x) : 50,
            y: bn.y !== null && bn.y !== undefined ? Number(bn.y) : 50,
            countdownSize: bn.countdownSize ?? "normal",
            countdownColor: bn.countdownColor ?? "gold",
            createdAt: toDate(bn.createdAt),
            updatedAt: toDate(bn.updatedAt),
          },
        });
      }
      importedByTable.banners = snapshot.banners.length;

      let ufcCount = 0;
      for (const ufc of snapshot.userFeeConfigs) {
        const uid = userIdMap.get(ufc.userId);
        if (!uid) continue;
        const existingUfc = await tx.userFeeConfig.findUnique({
          where: { userId: uid },
        });
        if (existingUfc) {
          await tx.userFeeConfig.update({
            where: { userId: uid },
            data: { amount: Number(ufc.amount ?? 0) },
          });
        } else {
          const idTaken = await tx.userFeeConfig.findUnique({
            where: { id: ufc.id },
          });
          await tx.userFeeConfig.create({
            data: {
              ...(idTaken ? {} : { id: ufc.id }),
              userId: uid,
              amount: Number(ufc.amount ?? 0),
              updatedAt: toDate(ufc.updatedAt),
            },
          });
        }
        ufcCount += 1;
      }
      importedByTable.user_fee_configs = ufcCount;

      const feeRecordIdMap = new Map<string, string>();
      for (const fr of snapshot.feeRecords) {
        const uid = userIdMap.get(fr.userId);
        if (!uid) continue;
        const month = Number(fr.month ?? 0);
        const year = Number(fr.year ?? 2026);

        const byComposite = await tx.feeRecord.findUnique({
          where: { userId_month_year: { userId: uid, month, year } },
        });
        const byId = await tx.feeRecord.findUnique({ where: { id: fr.id } });
        const target = byComposite || byId;

        if (target) {
          await tx.feeRecord.update({
            where: { id: target.id },
            data: {
              amount: Number(fr.amount ?? 0),
              paidAmount: Number(fr.paidAmount ?? 0),
              status: coerceFeeStatus(fr.status),
            },
          });
          feeRecordIdMap.set(fr.id, target.id);
        } else {
          const created = await tx.feeRecord.create({
            data: {
              id: fr.id,
              userId: uid,
              month,
              year,
              amount: Number(fr.amount ?? 0),
              paidAmount: Number(fr.paidAmount ?? 0),
              status: coerceFeeStatus(fr.status),
              createdAt: toDate(fr.createdAt),
              updatedAt: toDate(fr.updatedAt),
            },
          });
          feeRecordIdMap.set(fr.id, created.id);
        }
      }
      importedByTable.fee_records = feeRecordIdMap.size;

      const validFeeTxIds = new Set<string>();
      for (const ft of snapshot.feeTransactions) {
        const uid = userIdMap.get(ft.userId);
        if (!uid) continue;
        await tx.feeTransaction.upsert({
          where: { id: ft.id },
          update: {
            userId: uid,
            amount: Number(ft.amount ?? 0),
            mode: ft.mode || "CASH",
            reference: ft.reference ?? null,
            note: ft.note ?? null,
            date: toDate(ft.date),
          },
          create: {
            id: ft.id,
            userId: uid,
            amount: Number(ft.amount ?? 0),
            mode: ft.mode || "CASH",
            reference: ft.reference ?? null,
            note: ft.note ?? null,
            date: toDate(ft.date),
          },
        });
        validFeeTxIds.add(ft.id);
      }
      importedByTable.fee_transactions = validFeeTxIds.size;

      const validContributionIds = new Set<string>();
      for (const ec of snapshot.eventContributions) {
        const uid = userIdMap.get(ec.userId);
        if (!uid) continue;
        await tx.eventContribution.upsert({
          where: { id: ec.id },
          update: {
            userId: uid,
            title: ec.title,
            amount: Number(ec.amount ?? 0),
            paidAmount: Number(ec.paidAmount ?? 0),
            status: coerceFeeStatus(ec.status),
          },
          create: {
            id: ec.id,
            userId: uid,
            title: ec.title,
            amount: Number(ec.amount ?? 0),
            paidAmount: Number(ec.paidAmount ?? 0),
            status: coerceFeeStatus(ec.status),
            createdAt: toDate(ec.createdAt),
            updatedAt: toDate(ec.updatedAt),
          },
        });
        validContributionIds.add(ec.id);
      }
      importedByTable.event_contributions = validContributionIds.size;

      let ftaCount = 0;
      for (const fta of snapshot.feeTransactionAllocations) {
        if (!validFeeTxIds.has(fta.transactionId)) continue;
        const mappedFeeRecordId = fta.feeRecordId
          ? (feeRecordIdMap.get(fta.feeRecordId) ?? null)
          : null;
        const mappedContributionId =
          fta.eventContributionId &&
          validContributionIds.has(fta.eventContributionId)
            ? fta.eventContributionId
            : null;

        await tx.feeTransactionAllocation.upsert({
          where: { id: fta.id },
          update: {
            allocatedAmount: Number(fta.allocatedAmount ?? 0),
            feeRecordId: mappedFeeRecordId,
            eventContributionId: mappedContributionId,
          },
          create: {
            id: fta.id,
            transactionId: fta.transactionId,
            feeRecordId: mappedFeeRecordId,
            eventContributionId: mappedContributionId,
            allocatedAmount: Number(fta.allocatedAmount ?? 0),
          },
        });
        ftaCount += 1;
      }
      importedByTable.fee_transaction_allocations = ftaCount;

      for (const fc of snapshot.floorConfigs) {
        const mapJoinUsers = (rows: Array<{ A: string; B: string }>) => {
          const uniqueIds = new Set<string>();
          for (const j of rows) {
            if (j.A === fc.id) {
              const mapped = userIdMap.get(String(j.B));
              if (mapped) uniqueIds.add(mapped);
            }
          }
          return [...uniqueIds].map((id) => ({ id }));
        };

        const headIds = mapJoinUsers(snapshot.floorHeadsJoin);
        const subHeadIds = mapJoinUsers(snapshot.floorSubHeadsJoin);
        const memberIds = mapJoinUsers(snapshot.floorMembersJoin);

        const byId = await tx.floorConfig.findUnique({ where: { id: fc.id } });
        const byName = await tx.floorConfig.findUnique({
          where: { name: fc.name },
        });
        const target = byId || byName;

        if (target) {
          await tx.floorConfig.update({
            where: { id: target.id },
            data: {
              ...(byName && byName.id !== target.id ? {} : { name: fc.name }),
              heads: { set: headIds },
              subHeads: { set: subHeadIds },
              members: { set: memberIds },
            },
          });
        } else {
          await tx.floorConfig.create({
            data: {
              id: fc.id,
              name: fc.name,
              createdAt: toDate(fc.createdAt),
              updatedAt: toDate(fc.updatedAt),
              heads: { connect: headIds },
              subHeads: { connect: subHeadIds },
              members: { connect: memberIds },
            },
          });
        }
      }
      importedByTable.floor_configs = snapshot.floorConfigs.length;

      let arCount = 0;
      for (const ar of snapshot.attendanceRecords) {
        const uid = userIdMap.get(ar.userId);
        if (!validEventIds.has(ar.eventId) || !uid) continue;
        const markerId = ar.markedById
          ? (userIdMap.get(ar.markedById) ?? null)
          : null;

        await tx.attendanceRecord.upsert({
          where: {
            eventId_userId: {
              eventId: ar.eventId,
              userId: uid,
            },
          },
          update: {
            status: coerceAttendanceStatus(ar.status),
            markedById: markerId,
          },
          create: {
            id: ar.id,
            eventId: ar.eventId,
            userId: uid,
            markedById: markerId,
            status: coerceAttendanceStatus(ar.status),
            timestamp: toDate(ar.timestamp),
          },
        });
        arCount += 1;
      }
      importedByTable.attendance_records = arCount;

      let aecCount = 0;
      for (const aec of snapshot.attendanceEventClones) {
        if (!validEventIds.has(aec.eventId)) continue;
        await tx.attendanceEventClone.upsert({
          where: { eventId: aec.eventId },
          update: {
            isActive: Boolean(aec.isActive),
            startTime: toDate(aec.startTime),
            endTime: toDate(aec.endTime),
          },
          create: {
            id: aec.id,
            eventId: aec.eventId,
            isActive: Boolean(aec.isActive),
            startTime: toDate(aec.startTime),
            endTime: toDate(aec.endTime),
            createdAt: toDate(aec.createdAt),
          },
        });
        aecCount += 1;
      }
      importedByTable.attendance_event_clones = aecCount;
      },
      { maxWait: 20000, timeout: 180000 }
    )
  );

  sqliteAdapterFactory.checkpointWalPassive();

  const totalImported = Object.values(importedByTable).reduce((a, b) => a + b, 0);
  const durationMs = Math.round(performance.now() - startedAt);

  await recordActivity({
    action: "MIGRATION_COMPLETED",
    summary: `Synced ${totalImported} records from previous office records in ${(durationMs / 1000).toFixed(1)}s`,
    userId: params.actor.id,
    userName: params.actor.name,
    details: {
      totalImported,
      durationMs,
      importedByTable,
    },
  });

  return {
    ok: true,
    durationMs,
    importedByTable,
    totalImported,
    warnings,
  };
}

/**
 * Syncs accounts from the configured previous database (`NEON_DATABASE_URL`) when a user
 * opens the portal for the first time or tries to sign in with an account that is not yet
 * in local SQLite.
 *
 * - If SQLite has 0 users OR 0 events (initial sync), runs the full 24-table read-only sync.
 * - Otherwise, syncs only accounts & section permissions (`modules`, `module_links`,
 *   `users`, `user_module_access`) so local bookings/inventory remain untouched.
 */
export async function syncAccountsOrInitialDataFromNeon(): Promise<{
  mode: "full" | "accounts_only";
  totalImported: number;
  usersSynced: number;
  durationMs: number;
}> {
  const neonUrl = (process.env.NEON_DATABASE_URL || "").trim();
  if (!neonUrl) {
    throw new Error(
      "Previous database connection URL (NEON_DATABASE_URL) is not set in .env."
    );
  }

  const [userCount, eventCount] = await Promise.all([
    db.user.count(),
    db.event.count(),
  ]);

  if (userCount === 0 || eventCount === 0) {
    const full = await runOneClickNeonToSqliteMigration({
      actor: { id: "system", name: "Database Sync" },
    });
    return {
      mode: "full",
      totalImported: full.totalImported,
      usersSynced: full.importedByTable.users ?? 0,
      durationMs: full.durationMs,
    };
  }

  const startedAt = performance.now();
  const snapshot = await withReadOnlyNeonClient(
    neonUrl,
    async (client, existingTables) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectAll = async (tableName: string): Promise<any[]> => {
        if (!existingTables.has(tableName)) return [];
        const res = await client.query(`SELECT * FROM "${tableName}"`);
        return res.rows;
      };
      return {
        modules: await selectAll("modules"),
        moduleLinks: await selectAll("module_links"),
        users: await selectAll("users"),
        userModuleAccess: await selectAll("user_module_access"),
      };
    }
  );

  let totalImported = 0;

  await withWriteLock(() =>
    db.$transaction(
      async (tx) => {
      const moduleIdMap = new Map<string, string>();
      for (const m of snapshot.modules) {
        const byId = await tx.module.findUnique({ where: { id: m.id } });
        const byName = await tx.module.findUnique({ where: { name: m.name } });
        if (byId) {
          moduleIdMap.set(m.id, byId.id);
        } else if (byName) {
          moduleIdMap.set(m.id, byName.id);
        } else {
          const created = await tx.module.create({
            data: {
              id: m.id,
              name: m.name,
              description: m.description ?? null,
              icon: m.icon ?? null,
              createdAt: toDate(m.createdAt),
            },
          });
          moduleIdMap.set(m.id, created.id);
        }
      }
      for (const defMod of DEFAULT_PORTAL_MODULES) {
        const existingById = await tx.module.findUnique({
          where: { id: defMod.id },
        });
        const existingByName = await tx.module.findUnique({
          where: { name: defMod.name },
        });
        if (!existingById && !existingByName) {
          await tx.module.create({
            data: {
              id: defMod.id,
              name: defMod.name,
              description: defMod.description,
              icon: defMod.icon,
            },
          });
        }
      }
      totalImported += snapshot.modules.length;

      for (const ml of snapshot.moduleLinks) {
        const mappedModuleId = moduleIdMap.get(ml.moduleId);
        if (!mappedModuleId) continue;
        await tx.moduleLink.upsert({
          where: { id: ml.id },
          update: {
            moduleId: mappedModuleId,
            path: ml.path,
            label: ml.label ?? null,
            order: Number(ml.order ?? 0),
          },
          create: {
            id: ml.id,
            moduleId: mappedModuleId,
            path: ml.path,
            label: ml.label ?? null,
            order: Number(ml.order ?? 0),
          },
        });
        totalImported += 1;
      }

      const userIdMap = new Map<string, string>();
      const existingUsers = await tx.user.findMany({
        select: { id: true, username: true, its: true },
      });
      const idToUser = new Map(existingUsers.map((x) => [x.id, x]));
      const usernameToId = new Map(existingUsers.map((x) => [x.username, x.id]));
      const itsToId = new Map<string, string>();
      for (const ex of existingUsers) {
        if (ex.its) itsToId.set(ex.its, ex.id);
      }

      for (const u of snapshot.users) {
        const cleanUsername = String(u.username || "").trim();
        if (!cleanUsername) continue;
        const rawIts = cleanNullableUnique(u.its);
        const matchId =
          (idToUser.has(u.id) ? u.id : undefined) ||
          usernameToId.get(cleanUsername) ||
          (rawIts ? itsToId.get(rawIts) : undefined);

        const safeIts =
          rawIts && (!itsToId.has(rawIts) || itsToId.get(rawIts) === (matchId || u.id))
            ? rawIts
            : null;

        if (matchId) {
          userIdMap.set(u.id, matchId);
        } else {
          const created = await tx.user.create({
            data: {
              id: u.id,
              username: cleanUsername,
              password: String(u.password || ""),
              email: u.email ?? null,
              mobile: u.mobile ?? null,
              name: u.name ?? null,
              role: coerceRole(u.role),
              profileStatus: coerceProfileStatus(u.profileStatus),
              dob: toNullableDate(u.dob),
              quranHifz: u.quranHifz ?? null,
              passport: u.passport ?? null,
              kunSafar: u.kunSafar ?? null,
              occupation: u.occupation ?? null,
              sports: u.sports ?? null,
              its: safeIts,
              createdAt: toDate(u.createdAt),
              updatedAt: toDate(u.updatedAt),
            },
          });
          userIdMap.set(u.id, created.id);
          idToUser.set(created.id, {
            id: created.id,
            username: cleanUsername,
            its: safeIts,
          });
          usernameToId.set(cleanUsername, created.id);
          if (safeIts) itsToId.set(safeIts, created.id);
        }
      }

      for (const u of snapshot.users) {
        const selfId = userIdMap.get(u.id);
        const headId = u.headedById ? userIdMap.get(u.headedById) : undefined;
        if (selfId && headId) {
          await tx.user.update({
            where: { id: selfId },
            data: { headedById: headId },
          });
        }
      }
      totalImported += snapshot.users.length;

      for (const uma of snapshot.userModuleAccess) {
        const uid = userIdMap.get(uma.userId);
        const mid = moduleIdMap.get(uma.moduleId);
        if (!uid || !mid) continue;
        const existingUma = await tx.userModuleAccess.findUnique({
          where: { userId_moduleId: { userId: uid, moduleId: mid } },
        });
        if (!existingUma) {
          const idTaken = await tx.userModuleAccess.findUnique({
            where: { id: uma.id },
          });
          await tx.userModuleAccess.create({
            data: {
              ...(idTaken ? {} : { id: uma.id }),
              userId: uid,
              moduleId: mid,
              createdAt: toDate(uma.createdAt),
            },
          });
          totalImported += 1;
        }
      }
      },
      { maxWait: 15000, timeout: 60000 }
    )
  );

  const durationMs = Math.round(performance.now() - startedAt);
  await recordActivity({
    action: "ACCOUNTS_SYNCED",
    summary: `Synced ${snapshot.users.length} accounts from previous database in ${(durationMs / 1000).toFixed(1)}s`,
    userId: "system",
    userName: "Account Sync",
  });

  return {
    mode: "accounts_only",
    totalImported,
    usersSynced: snapshot.users.length,
    durationMs,
  };
}
