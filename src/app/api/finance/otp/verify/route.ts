import { NextResponse } from "next/server";
import { setAmountUnlockCookie, verifyEmailOtp } from "@sezsec/auth";
import { recordActivity } from "@sezsec/logs";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  if (!auth.user.canViewCharges) {
    return NextResponse.json(
      {
        error:
          "You do not have access to Event Charges. Only accounts with the Event Charges module enabled can unlock booking amounts.",
      },
      { status: 403 }
    );
  }

  if (!auth.user.email) {
    return NextResponse.json(
      { error: "Please save your email address in My Profile first." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const code = String(body?.code || "");

  const verified = await verifyEmailOtp({
    email: auth.user.email,
    code,
    purpose: "AMOUNT_REVEAL",
  });

  if (!verified.valid) {
    return NextResponse.json(
      { error: verified.reason || "Invalid code." },
      { status: 400 }
    );
  }

  const expiresAt = await setAmountUnlockCookie(auth.user.id);

  await recordActivity({
    action: "AMOUNT_UNLOCKED",
    summary: `${auth.user.name || auth.user.username} verified Email Code to view charges`,
    userId: auth.user.id,
    userName: auth.user.name || auth.user.username,
  });

  return NextResponse.json({
    ok: true,
    unlocked: true,
    expiresAt,
  });
}
