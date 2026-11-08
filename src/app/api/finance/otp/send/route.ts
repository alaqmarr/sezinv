import { NextResponse } from "next/server";
import { issueEmailOtp } from "@sezsec/auth";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

export async function POST() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  if (!auth.user.canViewCharges) {
    return NextResponse.json(
      {
        error:
          "You do not have access to Event Charges. Only accounts with the Event Charges module enabled can request verification codes.",
      },
      { status: 403 }
    );
  }

  if (!auth.user.email) {
    return NextResponse.json(
      {
        error:
          "No email address is saved on your account yet. Please add your email on the My Profile page first.",
      },
      { status: 400 }
    );
  }

  const otpInfo = await issueEmailOtp({
    email: auth.user.email,
    userId: auth.user.id,
    recipientName: auth.user.name || auth.user.username,
    purpose: "AMOUNT_REVEAL",
  });

  return NextResponse.json({
    ok: true,
    maskedEmail: otpInfo.maskedEmail,
    emailSent: otpInfo.emailSent,
    devPreviewCode: otpInfo.devPreviewCode,
  });
}
