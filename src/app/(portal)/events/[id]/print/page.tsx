import React, { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getEventAmountUnlockStatus } from "@sezsec/auth/booking-print-unlock.helper";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { getEventById } from "@sezsec/events/events.service";
import { getBookingGuidelines } from "@sezsec/settings/settings.service";
import { Skeleton } from "@sezsec/ui";
import { EventPrintClient } from "./event-print.client";

async function EventPrintContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  await connection();
  const user = await requireServerPageAccess("/events/[id]/print");
  const { id } = await paramsPromise;
  const decodedId = decodeURIComponent(id);
  const unlock = await getEventAmountUnlockStatus(user.id, decodedId);

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
      canEditCharges={canPerformAction("event:costs:edit", user.role)}
    />
  );
}

export default function EventPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="w-full space-y-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[640px] w-full" />
        </div>
      }
    >
      <EventPrintContent paramsPromise={params} />
    </Suspense>
  );
}
