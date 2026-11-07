import { NextResponse } from "next/server";
import { clearAmountUnlockCookie } from "@sezsec/auth";
import { clearBookingPrintUnlockCookie } from "@sezsec/auth/booking-print-unlock.helper";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  if (body?.scope === "booking") {
    await clearBookingPrintUnlockCookie();
  } else {
    await clearAmountUnlockCookie();
    await clearBookingPrintUnlockCookie();
  }

  return NextResponse.json({ ok: true, unlocked: false });
}
