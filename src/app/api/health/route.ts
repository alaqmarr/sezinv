import { connection, NextResponse } from "next/server";
import { getDatabaseHealth } from "@sezsec/db";
import { getResolvedSmtpCredentials } from "@sezsec/notifications/smtp-config.helper";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

export async function GET() {
  await connection();
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const [database, smtp] = await Promise.all([
    getDatabaseHealth(),
    getResolvedSmtpCredentials(),
  ]);

  return NextResponse.json({
    database,
    emailConfigured: smtp.configured,
    senderEmail: smtp.smtpEmail,
    neonSourceConfigured: Boolean(process.env.NEON_DATABASE_URL),
  });
}
