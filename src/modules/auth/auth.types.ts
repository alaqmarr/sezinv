import type { AppRole } from "@sezsec/shared";

export interface SessionUser {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  role: AppRole;
  profileStatus: "COMPLETED" | "SKIPPED" | null;
}

export type OtpPurpose =
  | "AMOUNT_REVEAL"
  | "PASSWORD_RESET"
  | "PROFILE_PASSWORD"
  | "SYSTEM_RESET";

export interface AmountUnlockStatus {
  unlocked: boolean;
  expiresAt: number | null;
}
