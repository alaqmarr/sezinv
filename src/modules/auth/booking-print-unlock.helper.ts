import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getAmountUnlockStatus } from "./session.helper";

export const BOOKING_PRINT_UNLOCK_COOKIE_NAME = "sezsec_booking_print_unlock";
const BOOKING_PRINT_UNLOCK_MAX_AGE_SEC = 60 * 10; // 10 minutes for newly created booking printout

function getBookingUnlockKey(): Uint8Array {
  const secret =
    process.env.AMOUNT_OTP_SECRET ||
    process.env.AUTH_SECRET ||
    "sezsec-amount-reveal-otp-secret-2026";
  return new TextEncoder().encode(secret);
}

export interface EventAmountUnlockStatus {
  unlocked: boolean;
  expiresAt: number | null;
  source: "OTP" | "NEW_BOOKING_PRINT" | null;
}

/**
 * Unlocks charges ONLY for a newly created booking for 10 minutes so the
 * office clerk can immediately print/share the confirmation PDF with the booker.
 */
export async function setBookingPrintUnlockCookie(
  userId: string,
  eventId: string
): Promise<number> {
  const expiresAt = Date.now() + BOOKING_PRINT_UNLOCK_MAX_AGE_SEC * 1000;
  const token = await new SignJWT({ userId, eventId, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${BOOKING_PRINT_UNLOCK_MAX_AGE_SEC}s`)
    .sign(getBookingUnlockKey());

  const store = await cookies();
  store.set(BOOKING_PRINT_UNLOCK_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BOOKING_PRINT_UNLOCK_MAX_AGE_SEC,
  });

  return expiresAt;
}

export async function clearBookingPrintUnlockCookie(): Promise<void> {
  const store = await cookies();
  store.delete(BOOKING_PRINT_UNLOCK_COOKIE_NAME);
}

export async function getBookingPrintUnlockStatus(
  userId: string | null | undefined,
  eventId: string
): Promise<{ unlocked: boolean; expiresAt: number | null }> {
  if (!userId || !eventId) return { unlocked: false, expiresAt: null };
  const store = await cookies();
  const token = store.get(BOOKING_PRINT_UNLOCK_COOKIE_NAME)?.value;
  if (!token) return { unlocked: false, expiresAt: null };

  try {
    const { payload } = await jwtVerify(token, getBookingUnlockKey());
    if (payload.userId !== userId || payload.eventId !== eventId) {
      return { unlocked: false, expiresAt: null };
    }
    const expiresAt = Number(payload.expiresAt || 0);
    if (expiresAt <= Date.now()) {
      return { unlocked: false, expiresAt: null };
    }
    return { unlocked: true, expiresAt };
  } catch {
    return { unlocked: false, expiresAt: null };
  }
}

export async function getEventAmountUnlockStatus(
  userId: string | null | undefined,
  eventId: string,
  canViewCharges = true
): Promise<EventAmountUnlockStatus> {
  if (!userId || !canViewCharges) {
    return {
      unlocked: false,
      expiresAt: null,
      source: null,
    };
  }

  const globalUnlock = await getAmountUnlockStatus(userId, canViewCharges);
  if (globalUnlock.unlocked) {
    return {
      unlocked: true,
      expiresAt: globalUnlock.expiresAt,
      source: "OTP",
    };
  }

  const printUnlock = await getBookingPrintUnlockStatus(userId, eventId);
  if (printUnlock.unlocked) {
    return {
      unlocked: true,
      expiresAt: printUnlock.expiresAt,
      source: "NEW_BOOKING_PRINT",
    };
  }

  return {
    unlocked: false,
    expiresAt: null,
    source: null,
  };
}
