import { connection } from "next/server";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { listEvents } from "@sezsec/events/events.service";
import { EventsListClient } from "./events-list.client";

export default async function EventsPage() {
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
