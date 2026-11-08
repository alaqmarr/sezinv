import React, { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { getEventById } from "@sezsec/events/events.service";
import { listEventActivity } from "@sezsec/logs";
import { Skeleton } from "@sezsec/ui";
import { EventDetailClient } from "./event-detail.client";

async function EventDetailContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  await connection();
  const user = await requireServerPageAccess("/events/[id]");
  const { id } = await paramsPromise;
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

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      }
    >
      <EventDetailContent paramsPromise={params} />
    </Suspense>
  );
}
