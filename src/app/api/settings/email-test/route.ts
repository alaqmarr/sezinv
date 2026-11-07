import { NextResponse } from "next/server";
import {
  buildOtpEmailHtml,
  sendPortalEmail,
} from "@sezsec/notifications";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

export async function POST(request: Request) {
  const auth = await requireApiAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const targetEmail = String(body?.to || auth.user.email || "").trim();
  if (!targetEmail) {
    return NextResponse.json(
      { error: "Please enter a recipient email address." },
      { status: 400 }
    );
  }

  const result = await sendPortalEmail({
    to: targetEmail,
    subject: "Test Email — Jamaat Events Secunderabad",
    html: buildOtpEmailHtml({
      recipientName: auth.user.name || auth.user.username,
      code: "123456",
      purposeLabel: "Email Delivery Test",
    }),
  });

  if (!result.sent) {
    return NextResponse.json(
      {
        error:
          result.error ||
          "Email could not be sent. Please check the sender email address and app password in Office Settings.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
