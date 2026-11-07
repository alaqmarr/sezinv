export type AppRole =
  | "ADMIN"
  | "ADMIN_CUSTOM"
  | "MANAGER"
  | "STAFF"
  | "WATCHER"
  | "USER";

export interface MisriDateInfo {
  day: number;
  month: number;
  year: number;
  monthNameEn: string;
  monthNameAr: string;
  dayAr: string;
  yearAr: string;
  formattedEn: string;
  formattedAr: string;
}

export interface ApiResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
