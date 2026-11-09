import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { EventBookingForm } from "@sezsec/events";
import { getEventById } from "@sezsec/events/events.service";
import { getPortalMasterSettings } from "@sezsec/settings/settings.service";
import { PageHeader } from "@sezsec/ui";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const user = await requireServerPageAccess("/events/[id]/edit");
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const unlock = await getAmountUnlockStatus(user.id, user.canViewCharges);

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
        key={`${event.id}:${event.updatedAt}`}
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
