import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getEventAmountUnlockStatus } from "@sezsec/auth/booking-print-unlock.helper";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { getEventById } from "@sezsec/events/events.service";
import { getBookingGuidelines } from "@sezsec/settings/settings.service";
import { EventPrintClient } from "./event-print.client";

export default async function EventPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const user = await requireServerPageAccess("/events/[id]/print");
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const unlock = await getEventAmountUnlockStatus(
    user.id,
    decodedId,
    user.canViewCharges
  );

  const [event, guidelines] = await Promise.all([
    getEventById(decodedId, unlock.unlocked),
    getBookingGuidelines(),
  ]);

  if (!event) notFound();

  return (
    <EventPrintClient
      event={event}
      guidelines={guidelines}
      amountsUnlocked={unlock.unlocked}
      printUnlockExpiresAt={
        unlock.source === "NEW_BOOKING_PRINT" ? unlock.expiresAt : null
      }
      canEditCharges={
        user.canViewCharges && canPerformAction("event:costs:edit", user.role)
      }
    />
  );
}
