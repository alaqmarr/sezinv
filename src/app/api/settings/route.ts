import { connection, NextResponse } from "next/server";
import { saveSmtpCredentials } from "@sezsec/notifications/smtp-config.helper";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import {
  getPortalMasterSettings,
  saveBookingGuidelines,
  saveBookingWindowMinutes,
} from "@sezsec/settings/settings.service";

export async function GET() {
  await connection();
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const settings = await getPortalMasterSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    if (body?.emailSettings !== undefined) {
      if (auth.user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Only an Administrator can update outgoing email settings." },
          { status: 403 }
        );
      }
      const savedEmail = await saveSmtpCredentials({
        smtpEmail: String(body.emailSettings.smtpEmail || ""),
        smtpPassword:
          body.emailSettings.smtpPassword !== undefined
            ? String(body.emailSettings.smtpPassword)
            : undefined,
      });
      return NextResponse.json({ ok: true, emailSettings: savedEmail });
    }

    if (body?.bookingWindowMinutes !== undefined) {
      const saved = await saveBookingWindowMinutes(
        Number(body.bookingWindowMinutes)
      );
      return NextResponse.json({ ok: true, bookingWindowMinutes: saved });
    }

    if (body?.guidelines) {
      const saved = await saveBookingGuidelines({
        dos: Array.isArray(body.guidelines.dos)
          ? body.guidelines.dos.map(String)
          : [],
        donts: Array.isArray(body.guidelines.donts)
          ? body.guidelines.donts.map(String)
          : [],
        footerNote: String(body.guidelines.footerNote || ""),
      });
      return NextResponse.json({ ok: true, guidelines: saved });
    }

    return NextResponse.json(
      { error: "Nothing to update." },
      { status: 400 }
    );
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not save office settings.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
