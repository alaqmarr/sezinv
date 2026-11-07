import { NextResponse } from "next/server";
import { withWriteTransaction } from "@sezsec/db";
import { verifyEmailOtp } from "@sezsec/auth";
import { recordActivity } from "@sezsec/logs";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

export async function POST(request: Request) {
  const auth = await requireApiAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;

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
    purpose: "SYSTEM_RESET",
  });

  if (!verified.valid) {
    return NextResponse.json(
      { error: verified.reason || "Invalid verification code." },
      { status: 400 }
    );
  }

  await withWriteTransaction(async (tx) => {
    await tx.eventInventory.deleteMany({});
    await tx.event.deleteMany({});
    await tx.activityLog.deleteMany({});

    const items = await tx.inventoryItem.findMany();
    for (const item of items) {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { availableQuantity: item.totalQuantity },
      });
    }
  });

  await recordActivity({
    action: "SYSTEM_RESET",
    summary: "Cleared all bookings and reset store available counts",
    userId: auth.user.id,
    userName: auth.user.name || auth.user.username,
  });

  return NextResponse.json({ ok: true });
}
