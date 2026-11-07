import React, { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { EventBookingForm } from "@sezsec/events";
import { getEventById } from "@sezsec/events/events.service";
import { getPortalMasterSettings } from "@sezsec/settings/settings.service";
import { PageHeader, Skeleton } from "@sezsec/ui";

async function EditEventContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  await connection();
  const user = await requireServerPageAccess("/events/[id]/edit");
  const { id } = await paramsPromise;
  const decodedId = decodeURIComponent(id);
  const unlock = await getAmountUnlockStatus(user.id);

  const [event, master] = await Promise.all([
    getEventById(decodedId, unlock.unlocked),
    getPortalMasterSettings(),
  ]);

  if (!event) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit Booking: ${event.description}`}
        subtitle={`Booker: ${event.name} (${event.mobile})`}
        arabicBadge="تعديل الحجز"
        backLink={
          <Link
            href={`/events/${encodeURIComponent(event.id)}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6A1B1B] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Booking Details
          </Link>
        }
      />

      <EventBookingForm
        mode="edit"
        initialEvent={event}
        halls={master.halls}
        caterers={master.caterers}
        decorators={master.decorators}
        amountsUnlocked={unlock.unlocked}
      />
    </div>
  );
}

export default function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <EditEventContent paramsPromise={params} />
    </Suspense>
  );
}
