import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type { SqlitePragmaSnapshot } from "./db.types";

type SqlDriverAdapter = Awaited<ReturnType<PrismaBetterSqlite3["connect"]>>;
type AdapterWithClient = SqlDriverAdapter & { client?: Database.Database };

export function resolveSqliteDatabasePath(rawUrl?: string): {
  filePath: string;
  prismaUrl: string;
} {
  const url = (rawUrl || process.env.DATABASE_URL || "file:./data/jamatevents.db").trim();
  if (url === ":memory:") {
    return { filePath: ":memory:", prismaUrl: ":memory:" };
  }
  const stripped = url.replace(/^file:/, "");
  const resolved = path.isAbsolute(stripped)
    ? stripped
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), stripped);

  fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(resolved), {
    recursive: true,
  });
  return {
    filePath: resolved,
    prismaUrl: `file:${resolved}`,
  };
}

export function applyOptimalSqlitePragmas(client: Database.Database): void {
  // Optimal concurrency & durability profile for multi-reader / serialized-writer web workloads:
  // 1. WAL allows concurrent readers during writes without blocking.
  // 2. synchronous = NORMAL prevents fsync on every commit while remaining crash-safe in WAL mode.
  // 3. busy_timeout = 10000ms waits cleanly for cross-process locks instead of failing immediately.
  // 4. foreign_keys = ON enforces relational integrity at the SQLite engine level.
  // 5. temp_store = MEMORY, 64MB page cache, and 256MB mmap keep read queries sub-millisecond.
  client.pragma("journal_mode = WAL");
  client.pragma("synchronous = NORMAL");
  client.pragma("busy_timeout = 10000");
  client.pragma("foreign_keys = ON");
  client.pragma("temp_store = MEMORY");
  client.pragma("cache_size = -64000");
  client.pragma("mmap_size = 268435456");
  client.pragma("wal_autocheckpoint = 1000");
}

export function readSqlitePragmaSnapshot(
  client: Database.Database,
  filePath: string
): SqlitePragmaSnapshot {
  const journalMode = String(client.pragma("journal_mode", { simple: true }) ?? "unknown");
  const synchronous = Number(client.pragma("synchronous", { simple: true }) ?? 0);
  const busyTimeoutMs = Number(client.pragma("busy_timeout", { simple: true }) ?? 0);
  const foreignKeys = Number(client.pragma("foreign_keys", { simple: true }) ?? 0) === 1;
  const cacheSizeRaw = Number(client.pragma("cache_size", { simple: true }) ?? 0);
  const walAutoCheckpoint = Number(client.pragma("wal_autocheckpoint", { simple: true }) ?? 0);
  const pageCount = Number(client.pragma("page_count", { simple: true }) ?? 0);
  const pageSize = Number(client.pragma("page_size", { simple: true }) ?? 4096);

  let databaseSizeBytes = pageCount * pageSize;
  if (filePath !== ":memory:" && fs.existsSync(filePath)) {
    try {
      const mainSize = fs.statSync(filePath).size;
      const walPath = `${filePath}-wal`;
      const walSize = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
      databaseSizeBytes = mainSize + walSize;
    } catch {
      // Fall back to pageCount * pageSize
    }
  }

  return {
    journalMode,
    synchronous,
    busyTimeoutMs,
    foreignKeys,
    cacheSizeKb: Math.abs(cacheSizeRaw),
    walAutoCheckpoint,
    pageCount,
    pageSize,
    databaseSizeBytes,
  };
}

export class SezsecSqliteAdapterFactory {
  readonly provider = "sqlite" as const;
  readonly adapterName: string;
  readonly filePath: string;
  private readonly innerFactory: PrismaBetterSqlite3;
  private rawClient: Database.Database | null = null;

  constructor(rawUrl?: string) {
    const { filePath, prismaUrl } = resolveSqliteDatabasePath(rawUrl);
    this.filePath = filePath;
    this.innerFactory = new PrismaBetterSqlite3(
      {
        url: prismaUrl,
        timeout: 10000,
      },
      {
        timestampFormat: "iso8601",
      }
    );
    this.adapterName = this.innerFactory.adapterName;
  }

  async connect(): Promise<SqlDriverAdapter> {
    const adapter = (await this.innerFactory.connect()) as AdapterWithClient;
    if (adapter.client) {
      applyOptimalSqlitePragmas(adapter.client);
      this.rawClient = adapter.client;
    }
    return adapter;
  }

  async connectToShadowDb(): Promise<SqlDriverAdapter> {
    return this.innerFactory.connectToShadowDb();
  }

  getRawClient(): Database.Database | null {
    return this.rawClient;
  }

  checkpointWalPassive(): void {
    if (this.rawClient) {
      try {
        this.rawClient.pragma("wal_checkpoint(PASSIVE)");
      } catch {
        // Non-fatal maintenance operation
      }
    }
  }
}
