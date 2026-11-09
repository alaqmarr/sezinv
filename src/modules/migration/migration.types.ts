export interface MigrationTableCount {
  table: string;
  label: string;
  group: "Events & Store" | "Shared Jamaat Portal";
  neonCount: number;
  sqliteCount: number;
}

export interface MigrationPreviewReport {
  neonConfigured: boolean;
  neonReachable: boolean;
  onlineChecked?: boolean;
  error?: string;
  tables: MigrationTableCount[];
  totalNeonRows: number;
  totalSqliteRows: number;
}

export interface MigrationRunResult {
  ok: boolean;
  durationMs: number;
  importedByTable: Record<string, number>;
  totalImported: number;
  warnings: string[];
}
