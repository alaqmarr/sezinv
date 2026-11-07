import { connection, NextResponse, type NextRequest } from "next/server";
import { db, withWriteTransaction } from "@sezsec/db";
import { getEventAmountUnlockStatus } from "@sezsec/auth/booking-print-unlock.helper";
import { isEventLocked } from "@sezsec/shared";
import { recordActivity } from "@sezsec/logs";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import { eventBookingSchema } from "@sezsec/events";
import {
  getEventById,
  updateEventBooking,
} from "@sezsec/events/events.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connection();
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const unlock = await getEventAmountUnlockStatus(auth.user.id, id);
  const event = await getEventById(id, unlock.unlocked);

  if (!event) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  return NextResponse.json({ event });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  try {
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
            "This booking is locked because more than 48 hours have passed since the function. Only an Administrator can edit it.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (
      body &&
      Object.keys(body).length === 1 &&
      typeof body.status === "string"
    ) {
      await withWriteTransaction((tx) =>
        tx.event.update({
          where: { id },
          data: {
            status: body.status as "BOOKED" | "COMPLETED" | "CANCELLED",
          },
        })
      );
      await recordActivity({
        action:
          body.status === "CANCELLED" ? "EVENT_CANCELLED" : "EVENT_UPDATED",
        summary: `Changed booking status to ${body.status} for ${existing.description}`,
        userId: auth.user.id,
        userName: auth.user.name || auth.user.username,
        eventId: id,
      });
      const unlock = await getEventAmountUnlockStatus(auth.user.id, id);
      const refreshed = await getEventById(id, unlock.unlocked);
      return NextResponse.json({ ok: true, event: refreshed });
    }

    const parsed = eventBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Please check the booking details.",
        },
        { status: 400 }
      );
    }

    const unlock = await getEventAmountUnlockStatus(auth.user.id, id);
    const updated = await updateEventBooking(
      id,
      parsed.data,
      {
        id: auth.user.id,
        name: auth.user.name || auth.user.username,
      },
      unlock.unlocked
    );

    return NextResponse.json({ ok: true, event: updated });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not update booking.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const force = request.nextUrl.searchParams.get("force") === "true";

  const existing = await db.event.findUnique({
    where: { id },
    include: { inventoryAllocations: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const unreturned = existing.inventoryAllocations.some(
    (a) => a.issuedQty - a.returnedQty - (a.lostQty - a.recoveredQty) > 0
  );

  if (unreturned && !force) {
    return NextResponse.json(
      {
        error:
          "Some store vessels issued to this booking have not been returned yet. Confirm removal if you still wish to delete this booking.",
        requiresForce: true,
      },
      { status: 409 }
    );
  }

  await withWriteTransaction(async (tx) => {
    await tx.activityLog.deleteMany({ where: { eventId: id } });
    await tx.event.delete({ where: { id } });
  });

  await recordActivity({
    action: "EVENT_DELETED",
    summary: `Deleted booking ${existing.description} (${existing.name})`,
    userId: auth.user.id,
    userName: auth.user.name || auth.user.username,
  });

  return NextResponse.json({ ok: true });
}
