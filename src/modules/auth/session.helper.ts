import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AmountUnlockStatus, SessionUser } from "./auth.types";

export const SESSION_COOKIE_NAME = "sezsec_session";
export const AMOUNT_UNLOCK_COOKIE_NAME = "sezsec_amount_unlock";
const BOOKING_PRINT_COOKIE = "sezsec_booking_print_unlock";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24; // 24 hours
const AMOUNT_UNLOCK_MAX_AGE_SEC = 60 * 20; // 20 minutes

function getSessionKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET || "sezsec-jamatevents-jwt-hmac-secret-2026";
  return new TextEncoder().encode(secret);
}

function getAmountKey(): Uint8Array {
  const secret =
    process.env.AMOUNT_OTP_SECRET ||
    process.env.AUTH_SECRET ||
    "sezsec-amount-reveal-otp-secret-2026";
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSessionKey());
}

export async function verifySessionToken(
  token: string | undefined
): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionKey());
    const user = payload.user as SessionUser | undefined;
    if (!user || !user.id || !user.role) return null;
    return user;
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const token = await signSessionToken(user);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  store.delete(AMOUNT_UNLOCK_COOKIE_NAME);
  store.delete(BOOKING_PRINT_COOKIE);
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function setAmountUnlockCookie(userId: string): Promise<number> {
  const expiresAt = Date.now() + AMOUNT_UNLOCK_MAX_AGE_SEC * 1000;
  const token = await new SignJWT({ userId, expiresAt })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${AMOUNT_UNLOCK_MAX_AGE_SEC}s`)
    .sign(getAmountKey());

  const store = await cookies();
  store.set(AMOUNT_UNLOCK_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AMOUNT_UNLOCK_MAX_AGE_SEC,
  });
  return expiresAt;
}

export async function clearAmountUnlockCookie(): Promise<void> {
  const store = await cookies();
  store.delete(AMOUNT_UNLOCK_COOKIE_NAME);
  store.delete(BOOKING_PRINT_COOKIE);
}

export async function getAmountUnlockStatus(
  userId: string | null | undefined
): Promise<AmountUnlockStatus> {
  if (!userId) return { unlocked: false, expiresAt: null };
  const store = await cookies();
  const token = store.get(AMOUNT_UNLOCK_COOKIE_NAME)?.value;
  if (!token) return { unlocked: false, expiresAt: null };

  try {
    const { payload } = await jwtVerify(token, getAmountKey());
    if (payload.userId !== userId) {
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
