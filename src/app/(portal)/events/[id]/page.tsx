import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { getEventById } from "@sezsec/events/events.service";
import { listEventActivity } from "@sezsec/logs";
import { EventDetailClient } from "./event-detail.client";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const user = await requireServerPageAccess("/events/[id]");
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const unlock = await getAmountUnlockStatus(user.id, user.canViewCharges);

  const [event, logs] = await Promise.all([
    getEventById(decodedId, unlock.unlocked),
    listEventActivity(decodedId),
  ]);

  if (!event) notFound();

  return (
    <EventDetailClient
      event={event}
      logs={logs}
      amountsUnlocked={unlock.unlocked}
      canEdit={canPerformAction("event:edit", user.role)}
      canEditCharges={
        user.canViewCharges && canPerformAction("event:costs:edit", user.role)
      }
      canDelete={canPerformAction("event:delete", user.role)}
      canManageVessels={canPerformAction("inventory:issue-return", user.role)}
    />
  );
}
