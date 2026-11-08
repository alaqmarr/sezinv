import React, { Suspense } from "react";
import { connection } from "next/server";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { listEvents } from "@sezsec/events/events.service";
import { MisriScheduleCalendar } from "@sezsec/calendar";
import { PageHeader, Skeleton } from "@sezsec/ui";

async function CalendarContent() {
  await connection();
  const user = await requireServerPageAccess("/events/calendar");
  const unlock = await getAmountUnlockStatus(user.id, user.canViewCharges);
  const events = await listEvents({ amountsUnlocked: unlock.unlocked });

  return (
    <MisriScheduleCalendar
      events={events}
      canCreateEvent={canPerformAction("event:create", user.role)}
    />
  );
}

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Misri & Gregorian Schedule Calendar"
        subtitle="Check hall availability by date with Dawoodi Bohra Misri Hijri dates"
        arabicBadge="التقويم الفاطمي"
      />
      <Suspense fallback={<Skeleton className="h-[520px] w-full" />}>
        <CalendarContent />
      </Suspense>
    </div>
  );
}
