import { connection } from "next/server";
import { notFound } from "next/navigation";
import { isEventLocked } from "@sezsec/shared";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { getEventById } from "@sezsec/events/events.service";
import { listStoreItems } from "@sezsec/inventory/inventory.service";
import { EventInventoryClient } from "./event-inventory.client";

export default async function EventInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const user = await requireServerPageAccess("/events/[id]/inventory");
  const { id } = await params;
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
