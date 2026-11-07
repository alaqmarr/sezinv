import crypto from "node:crypto";
import { db, withWriteLock } from "@sezsec/db";
import { maskEmail } from "@sezsec/shared";
import {
  buildOtpEmailHtml,
  sendPortalEmail,
} from "@sezsec/notifications";
import type { OtpPurpose } from "./auth.types";

const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

const PURPOSE_TITLES: Record<OtpPurpose, string> = {
  AMOUNT_REVEAL: "Code to View Booking Charges",
  PASSWORD_RESET: "Code to Reset Your Password",
  PROFILE_PASSWORD: "Code to Change Your Password",
  SYSTEM_RESET: "Code to Clear Portal Records",
};

function hashOtpCode(code: string, email: string, purpose: OtpPurpose): string {
  const secret =
    process.env.AMOUNT_OTP_SECRET ||
    process.env.AUTH_SECRET ||
    "sezsec-otp-hmac-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${purpose}:${email.toLowerCase().trim()}:${code.trim()}`)
    .digest("hex");
}

function generateSixDigitOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export async function issueEmailOtp(params: {
  email: string;
  userId?: string | null;
  recipientName?: string | null;
  purpose: OtpPurpose;
}): Promise<{
  maskedEmail: string;
  emailSent: boolean;
  smtpConfigured: boolean;
  devPreviewCode?: string;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  const code = generateSixDigitOtp();
  const codeHash = hashOtpCode(code, cleanEmail, params.purpose);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await withWriteLock(async () => {
    // Clean expired codes and replace any active code for the same email + purpose
    await db.verificationCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { email: cleanEmail, purpose: params.purpose },
        ],
      },
    });

    await db.verificationCode.create({
      data: {
        email: cleanEmail,
        codeHash,
        purpose: params.purpose,
        userId: params.userId || null,
        attempts: 0,
        expiresAt,
      },
    });
  });

  const purposeLabel = PURPOSE_TITLES[params.purpose];
  const emailResult = await sendPortalEmail({
    to: cleanEmail,
    subject: `${purposeLabel} — Jamaat Events Secunderabad`,
    html: buildOtpEmailHtml({
      recipientName: params.recipientName,
      code,
      purposeLabel,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    }),
  });

  if (!emailResult.smtpConfigured) {
    console.info(
      `[SEZSEC Local Dev OTP] Purpose=${params.purpose} | Email=${cleanEmail} | Code=${code}`
    );
  }

  return {
    maskedEmail: maskEmail(cleanEmail),
    emailSent: emailResult.sent,
    smtpConfigured: emailResult.smtpConfigured,
    // Only surface preview code in local development when SMTP password is not configured yet
    devPreviewCode:
      !emailResult.smtpConfigured && process.env.NODE_ENV !== "production"
        ? code
        : undefined,
  };
}

export async function verifyEmailOtp(params: {
  email: string;
  code: string;
  purpose: OtpPurpose;
}): Promise<{ valid: boolean; reason?: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanCode = params.code.replace(/\D/g, "").trim();

  if (cleanCode.length !== 6) {
    return { valid: false, reason: "Please enter the full 6-digit code." };
  }

  const record = await db.verificationCode.findFirst({
    where: {
      email: cleanEmail,
      purpose: params.purpose,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return {
      valid: false,
      reason: "No active verification code found. Please request a new code.",
    };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await withWriteLock(() =>
      db.verificationCode.delete({ where: { id: record.id } }).catch(() => null)
    );
    return {
      valid: false,
      reason: "This code has expired. Please request a fresh code.",
    };
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await withWriteLock(() =>
      db.verificationCode.delete({ where: { id: record.id } }).catch(() => null)
    );
    return {
      valid: false,
      reason: "Too many wrong attempts. Please request a new code.",
    };
  }

  const expectedHash = hashOtpCode(cleanCode, cleanEmail, params.purpose);
  const a = Buffer.from(record.codeHash, "utf8");
  const b = Buffer.from(expectedHash, "utf8");
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!matches) {
    await withWriteLock(() =>
      db.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      })
    );
    return {
      valid: false,
      reason: "Incorrect code entered. Please check your email and try again.",
    };
  }

  await withWriteLock(() =>
    db.verificationCode.delete({ where: { id: record.id } }).catch(() => null)
  );
  return { valid: true };
}
