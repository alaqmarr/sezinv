import React, { Suspense } from "react";
import { connection } from "next/server";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { listEvents } from "@sezsec/events/events.service";
import { Skeleton } from "@sezsec/ui";
import { EventsListClient } from "./events-list.client";

async function EventsPageContent() {
  await connection();
  const user = await requireServerPageAccess("/events");
  const unlock = await getAmountUnlockStatus(user.id, user.canViewCharges);
  const events = await listEvents({ amountsUnlocked: unlock.unlocked });

  return (
    <EventsListClient
      events={events}
      amountsUnlocked={unlock.unlocked}
      canCreate={canPerformAction("event:create", user.role)}
      canManageVessels={canPerformAction("inventory:issue-return", user.role)}
    />
  );
}

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <EventsPageContent />
    </Suspense>
  );
}
