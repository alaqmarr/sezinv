import { NextResponse } from "next/server";
import { db } from "@sezsec/db";
import { isEventLocked } from "@sezsec/shared";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import type { EventInventoryAction } from "@sezsec/inventory";
import { recordEventItemMovement } from "@sezsec/inventory/inventory.service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth([
    "ADMIN",
    "ADMIN_CUSTOM",
    "MANAGER",
    "STAFF",
  ]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (
      auth.user.role !== "ADMIN" &&
      isEventLocked(existing.occasionDate, existing.occasionTime)
    ) {
      return NextResponse.json(
        {
          error:
            "Store records for this booking are locked 48 hours after the function. Please ask an Administrator if an adjustment is needed.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const action = String(body?.action || "ISSUE") as EventInventoryAction;
    const itemId = String(body?.itemId || "");
    const quantity = Number(body?.quantity ?? 0);

    const saved = await recordEventItemMovement({
      eventId: id,
      itemId,
      action,
      quantity,
      actor: {
        id: auth.user.id,
        name: auth.user.name || auth.user.username,
      },
    });

    return NextResponse.json({ ok: true, allocation: saved });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not update store item entry.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
