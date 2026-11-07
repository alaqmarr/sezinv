import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, withWriteTransaction } from "@sezsec/db";

export const SMTP_EMAIL_CONFIG_KEY = "smtpEmail";
export const SMTP_PASSWORD_CONFIG_KEY = "smtpPassword";

const ENCRYPTED_PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.AMOUNT_OTP_SECRET ||
    "sezsec-jamatevents-smtp-config-key";
  return crypto.scryptSync(secret, "sezsec-smtp-salt-v1", 32);
}

export function encryptSmtpSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSmtpSecret(stored: string): string {
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    return stored;
  }
  try {
    const payload = stored.slice(ENCRYPTED_PREFIX.length);
    const [ivHex, tagHex, dataHex] = payload.split(":");
    if (!ivHex || !tagHex || !dataHex) return "";
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

export function maskSmtpPassword(rawPass: string): string {
  const compact = rawPass.replace(/\s+/g, "");
  if (!compact) return "";
  const tail = compact.slice(-4);
  return `•••• •••• •••• ${tail}`;
}

export interface ResolvedSmtpCredentials {
  smtpEmail: string;
  smtpPassword: string;
  configured: boolean;
  source: "DATABASE" | "ENV" | "NONE";
}

export async function getResolvedSmtpCredentials(): Promise<ResolvedSmtpCredentials> {
  const rows = await db.config.findMany({
    where: {
      key: { in: [SMTP_EMAIL_CONFIG_KEY, SMTP_PASSWORD_CONFIG_KEY] },
    },
  });

  const dbEmail = rows
    .find((r) => r.key === SMTP_EMAIL_CONFIG_KEY)
    ?.value?.trim();
  const dbPassRaw = rows
    .find((r) => r.key === SMTP_PASSWORD_CONFIG_KEY)
    ?.value?.trim();
  const dbPass = dbPassRaw ? decryptSmtpSecret(dbPassRaw).trim() : "";

  let envEmail = process.env.SMTP_EMAIL?.trim() || "";
  let envPass = process.env.SMTP_PASSWORD?.trim() || "";

  // If running dev server started before .env was updated, check .env on disk when DB is unseeded
  if (!dbPass && !envPass) {
    try {
      const envContent = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
      const mEmail = envContent.match(/^SMTP_EMAIL=["']?([^"'\r\n]+)["']?/m);
      const mPass = envContent.match(/^SMTP_PASSWORD=["']?([^"'\r\n]+)["']?/m);
      if (mEmail?.[1]?.trim()) envEmail = mEmail[1].trim();
      if (mPass?.[1]?.trim()) envPass = mPass[1].trim();
    } catch {
      // Ignore if .env file is absent
    }
  }

  // Auto-seed database config from env if DB doesn't have credentials stored yet
  if ((!dbEmail || !dbPass) && envEmail && envPass) {
    try {
      await saveSmtpCredentials({
        smtpEmail: dbEmail || envEmail,
        smtpPassword: dbPass || envPass,
      });
      return {
        smtpEmail: dbEmail || envEmail,
        smtpPassword: dbPass || envPass,
        configured: true,
        source: "DATABASE",
      };
    } catch {
      return {
        smtpEmail: dbEmail || envEmail,
        smtpPassword: dbPass || envPass,
        configured: true,
        source: "ENV",
      };
    }
  }

  const finalEmail = dbEmail || envEmail || "info@sezsec.org";
  const finalPass = dbPass || envPass || "";

  return {
    smtpEmail: finalEmail,
    smtpPassword: finalPass,
    configured: Boolean(finalEmail && finalPass),
    source: dbPass ? "DATABASE" : envPass ? "ENV" : "NONE",
  };
}

export async function getAdminSmtpSettingsSummary(): Promise<{
  smtpEmail: string;
  hasPassword: boolean;
  maskedPassword: string;
}> {
  const creds = await getResolvedSmtpCredentials();
  return {
    smtpEmail: creds.smtpEmail,
    hasPassword: Boolean(creds.smtpPassword),
    maskedPassword: creds.smtpPassword
      ? maskSmtpPassword(creds.smtpPassword)
      : "",
  };
}

export async function saveSmtpCredentials(input: {
  smtpEmail: string;
  smtpPassword?: string;
}): Promise<{
  smtpEmail: string;
  hasPassword: boolean;
  maskedPassword: string;
}> {
  const cleanEmail = input.smtpEmail.trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error("Please enter a valid sender email address.");
  }

  const nextPasswordRaw = input.smtpPassword?.trim();

  await withWriteTransaction(async (tx) => {
    await tx.config.upsert({
      where: { key: SMTP_EMAIL_CONFIG_KEY },
      update: { value: cleanEmail },
      create: { key: SMTP_EMAIL_CONFIG_KEY, value: cleanEmail },
    });

    if (nextPasswordRaw) {
      const encrypted = encryptSmtpSecret(nextPasswordRaw);
      await tx.config.upsert({
        where: { key: SMTP_PASSWORD_CONFIG_KEY },
        update: { value: encrypted },
        create: { key: SMTP_PASSWORD_CONFIG_KEY, value: encrypted },
      });
    }
  });

  return getAdminSmtpSettingsSummary();
}
