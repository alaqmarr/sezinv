import { NextResponse } from "next/server";
import { issueEmailOtp, type OtpPurpose } from "@sezsec/auth";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  if (!auth.user.email) {
    return NextResponse.json(
      {
        error:
          "Please add an email address in My Profile first so we can send you verification codes.",
      },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const purpose: OtpPurpose =
    body?.purpose === "SYSTEM_RESET" ? "SYSTEM_RESET" : "PROFILE_PASSWORD";

  const otpInfo = await issueEmailOtp({
    email: auth.user.email,
    userId: auth.user.id,
    recipientName: auth.user.name || auth.user.username,
    purpose,
  });

  return NextResponse.json({
    ok: true,
    maskedEmail: otpInfo.maskedEmail,
    emailSent: otpInfo.emailSent,
    devPreviewCode: otpInfo.devPreviewCode,
  });
}
