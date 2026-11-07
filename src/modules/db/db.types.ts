export interface SqlitePragmaSnapshot {
  journalMode: string;
  synchronous: number;
  busyTimeoutMs: number;
  foreignKeys: boolean;
  cacheSizeKb: number;
  walAutoCheckpoint: number;
  pageCount: number;
  pageSize: number;
  databaseSizeBytes: number;
}

export interface DatabaseHealthReport {
  status: "healthy" | "degraded";
  engine: "SQLite (WAL Mode)";
  filePath: string;
  latencyMs: number;
  pragmas: SqlitePragmaSnapshot;
  writeQueueDepth: number;
}
