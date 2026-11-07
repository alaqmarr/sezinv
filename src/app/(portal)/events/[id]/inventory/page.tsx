import React, { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { isEventLocked } from "@sezsec/shared";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { getEventById } from "@sezsec/events/events.service";
import { listStoreItems } from "@sezsec/inventory/inventory.service";
import { Skeleton } from "@sezsec/ui";
import { EventInventoryClient } from "./event-inventory.client";

async function EventInventoryContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  await connection();
  const user = await requireServerPageAccess("/events/[id]/inventory");
  const { id } = await paramsPromise;
  const decodedId = decodeURIComponent(id);

  const [event, storeItems] = await Promise.all([
    getEventById(decodedId, false),
    listStoreItems(),
  ]);

  if (!event) notFound();

  const lockedForUser =
    user.role !== "ADMIN" &&
    isEventLocked(event.occasionDate, event.occasionTime);

  return (
    <EventInventoryClient
      event={event}
      storeItems={storeItems}
      lockedForUser={lockedForUser}
    />
  );
}

export default function EventInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      }
    >
      <EventInventoryContent paramsPromise={params} />
    </Suspense>
  );
}
