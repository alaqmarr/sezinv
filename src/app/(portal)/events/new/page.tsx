import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { getPortalMasterSettings } from "@sezsec/settings/settings.service";
import { EventBookingForm } from "@sezsec/events";
import { PageHeader } from "@sezsec/ui";

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  await connection();
  const user = await requireServerPageAccess("/events/new");
  const [unlock, master, sp] = await Promise.all([
    getAmountUnlockStatus(user.id, user.canViewCharges),
    getPortalMasterSettings(),
    searchParams,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Hall Booking"
        subtitle="Record a new hall or home occasion, arrangements, decorator details, and charges"
        arabicBadge="حجز جديد"
        backLink={
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6A1B1B] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Hall Bookings
          </Link>
        }
      />

      <EventBookingForm
        mode="create"
        defaultDate={sp.date}
        halls={master.halls}
        caterers={master.caterers}
        decorators={master.decorators}
        amountsUnlocked={unlock.unlocked}
      />
    </div>
  );
}
