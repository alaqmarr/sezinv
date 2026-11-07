import { PrismaClient } from "@/generated/prisma/client";
import {
  SezsecSqliteAdapterFactory,
  readSqlitePragmaSnapshot,
} from "./db.adapter";
import { getWriteQueueDepth, withWriteLock } from "./db.concurrency";
import type { DatabaseHealthReport } from "./db.types";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

const globalForDb = globalThis as unknown as {
  __sezsecPrisma?: PrismaClient;
  __sezsecAdapterFactory?: SezsecSqliteAdapterFactory;
};

function createPrismaSingleton(): {
  prisma: PrismaClient;
  adapterFactory: SezsecSqliteAdapterFactory;
} {
  const adapterFactory = new SezsecSqliteAdapterFactory();
  const prisma = new PrismaClient({
    adapter: adapterFactory,
  });
  return { prisma, adapterFactory };
}

const singleton =
  globalForDb.__sezsecPrisma && globalForDb.__sezsecAdapterFactory
    ? {
        prisma: globalForDb.__sezsecPrisma,
        adapterFactory: globalForDb.__sezsecAdapterFactory,
      }
    : createPrismaSingleton();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__sezsecPrisma = singleton.prisma;
  globalForDb.__sezsecAdapterFactory = singleton.adapterFactory;
}

export const db = singleton.prisma;
export const prisma = singleton.prisma;
export const sqliteAdapterFactory = singleton.adapterFactory;

/**
 * Executes an atomic SQLite transaction inside the serialized FIFO write lock
 * with automatic transient lock retries.
 */
export async function withWriteTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>,
  options?: { timeoutMs?: number; maxWaitMs?: number }
): Promise<T> {
  return withWriteLock(() =>
    db.$transaction((tx) => fn(tx), {
      maxWait: options?.maxWaitMs ?? 10000,
      timeout: options?.timeoutMs ?? 30000,
    })
  );
}

export async function getDatabaseHealth(): Promise<DatabaseHealthReport> {
  const startedAt = performance.now();
  await db.$queryRaw`SELECT 1`;
  const latencyMs = Math.round((performance.now() - startedAt) * 100) / 100;

  const rawClient = sqliteAdapterFactory.getRawClient();
  const pragmas = rawClient
    ? readSqlitePragmaSnapshot(rawClient, sqliteAdapterFactory.filePath)
    : {
        journalMode: "wal",
        synchronous: 1,
        busyTimeoutMs: 10000,
        foreignKeys: true,
        cacheSizeKb: 64000,
        walAutoCheckpoint: 1000,
        pageCount: 0,
        pageSize: 4096,
        databaseSizeBytes: 0,
      };

  return {
    status: pragmas.journalMode.toLowerCase() === "wal" ? "healthy" : "degraded",
    engine: "SQLite (WAL Mode)",
    filePath: sqliteAdapterFactory.filePath,
    latencyMs,
    pragmas,
    writeQueueDepth: getWriteQueueDepth(),
  };
}
