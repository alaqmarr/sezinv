import { db, withWriteTransaction } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import {
  buildMissingItemAlertHtml,
  sendPortalEmail,
} from "@sezsec/notifications";
import type {
  EventInventoryAction,
  MissingItemRecord,
  StoreItem,
} from "./inventory.types";

function mapItem(row: {
  id: string;
  name: string;
  category: string;
  totalQuantity: number;
  availableQuantity: number;
  unit: string;
  createdAt: Date;
  updatedAt: Date;
}): StoreItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    totalQuantity: row.totalQuantity,
    availableQuantity: row.availableQuantity,
    unit: row.unit,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listStoreItems(): Promise<StoreItem[]> {
  const rows = await db.inventoryItem.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return rows.map(mapItem);
}

export async function getStoreItemById(id: string): Promise<StoreItem | null> {
  const row = await db.inventoryItem.findUnique({ where: { id } });
  return row ? mapItem(row) : null;
}

export async function createStoreItem(
  input: {
    name: string;
    category: string;
    totalQuantity: number;
    unit?: string;
  },
  actor: { id: string; name: string }
): Promise<StoreItem> {
  const qty = Math.max(0, Math.round(input.totalQuantity));
  const created = await withWriteTransaction((tx) =>
    tx.inventoryItem.create({
      data: {
        name: input.name.trim(),
        category: input.category.trim() || "General",
        totalQuantity: qty,
        availableQuantity: qty,
        unit: input.unit?.trim() || "pcs",
      },
    })
  );

  await recordActivity({
    action: "STOCK_ADDED",
    summary: `Added new store item "${created.name}" (${created.totalQuantity} ${created.unit})`,
    userId: actor.id,
    userName: actor.name,
    itemId: created.id,
    details: {
      itemName: created.name,
      category: created.category,
      quantity: created.totalQuantity,
      unit: created.unit,
    },
  });

  return mapItem(created);
}

export async function bulkCreateStoreItems(
  items: Array<{
    name: string;
    category: string;
    totalQuantity: number;
    unit?: string;
  }>,
  actor: { id: string; name: string }
): Promise<number> {
  const createdCount = await withWriteTransaction(async (tx) => {
    let count = 0;
    for (const raw of items) {
      if (!raw.name?.trim()) continue;
      const qty = Math.max(0, Math.round(Number(raw.totalQuantity) || 0));
      await tx.inventoryItem.create({
        data: {
          name: raw.name.trim(),
          category: raw.category?.trim() || "General",
          totalQuantity: qty,
          availableQuantity: qty,
          unit: raw.unit?.trim() || "pcs",
        },
      });
      count += 1;
    }
    return count;
  });

  await recordActivity({
    action: "STOCK_ADDED",
    summary: `Imported ${createdCount} store items in bulk`,
    userId: actor.id,
    userName: actor.name,
    details: { count: createdCount },
  });

  return createdCount;
}

export async function updateStoreItem(
  id: string,
  input: {
    name?: string;
    category?: string;
    totalQuantity?: number;
    unit?: string;
  },
  actor: { id: string; name: string }
): Promise<StoreItem> {
  const updated = await withWriteTransaction(async (tx) => {
    const existing = await tx.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("Store item not found.");
    }

    const nextTotal =
      input.totalQuantity !== undefined
        ? Math.max(0, Math.round(input.totalQuantity))
        : existing.totalQuantity;
    const diff = nextTotal - existing.totalQuantity;
    const nextAvailable = Math.max(0, existing.availableQuantity + diff);

    return tx.inventoryItem.update({
      where: { id },
      data: {
        name: input.name?.trim() || existing.name,
        category: input.category?.trim() || existing.category,
        totalQuantity: nextTotal,
        availableQuantity: nextAvailable,
        unit: input.unit?.trim() || existing.unit,
      },
    });
  });

  await recordActivity({
    action: "STOCK_UPDATED",
    summary: `Updated store item "${updated.name}" (Total: ${updated.totalQuantity} ${updated.unit})`,
    userId: actor.id,
    userName: actor.name,
    itemId: updated.id,
    details: {
      itemName: updated.name,
      totalQuantity: updated.totalQuantity,
      availableQuantity: updated.availableQuantity,
    },
  });

  return mapItem(updated);
}

export async function deleteStoreItem(
  id: string,
  actor: { id: string; name: string }
): Promise<void> {
  const removed = await withWriteTransaction(async (tx) => {
    const existing = await tx.inventoryItem.findUnique({
      where: { id },
      include: { _count: { select: { eventAllocations: true } } },
    });
    if (!existing) {
      throw new Error("Store item not found.");
    }
    if (existing._count.eventAllocations > 0) {
      throw new Error(
        "This item has been issued to bookings and cannot be deleted."
      );
    }
    await tx.inventoryItem.delete({ where: { id } });
    return existing;
  });

  await recordActivity({
    action: "STOCK_DELETED",
    summary: `Removed store item "${removed.name}"`,
    userId: actor.id,
    userName: actor.name,
    itemId: id,
  });
}

export async function recordEventItemMovement(params: {
  eventId: string;
  itemId: string;
  action: EventInventoryAction;
  quantity: number;
  actor: { id: string; name: string };
}) {
  const qty = Math.round(Number(params.quantity) || 0);
  if (qty < 0 || (qty === 0 && !params.action.startsWith("ADJUST_"))) {
    throw new Error("Please enter a valid quantity greater than zero.");
  }

  const outcome = await withWriteTransaction(async (tx) => {
    const [event, item] = await Promise.all([
      tx.event.findUnique({ where: { id: params.eventId } }),
      tx.inventoryItem.findUnique({ where: { id: params.itemId } }),
    ]);

    if (!event) throw new Error("Booking not found.");
    if (!item) throw new Error("Store item not found.");

    const existingAlloc = await tx.eventInventory.findUnique({
      where: {
        eventId_itemId: {
          eventId: params.eventId,
          itemId: params.itemId,
        },
      },
    });

    const currentIssued = existingAlloc?.issuedQty ?? 0;
    const currentReturned = existingAlloc?.returnedQty ?? 0;
    const currentLost = existingAlloc?.lostQty ?? 0;
    const currentRecovered = existingAlloc?.recoveredQty ?? 0;
    const outstanding = currentIssued - currentReturned - (currentLost - currentRecovered);

    let nextIssued = currentIssued;
    let nextReturned = currentReturned;
    let nextLost = currentLost;
    let nextAvailable = item.availableQuantity;
    let nextTotal = item.totalQuantity;
    let logAction = "INVENTORY_ISSUED";
    let logSummary = "";

    if (params.action === "ISSUE") {
      if (qty > item.availableQuantity) {
        throw new Error(
          `Only ${item.availableQuantity} ${item.unit} of "${item.name}" are currently in store.`
        );
      }
      nextIssued += qty;
      nextAvailable -= qty;
      logAction = "INVENTORY_ISSUED";
      logSummary = `Gave out ${qty} ${item.unit} of ${item.name} for ${event.description}`;
    } else if (params.action === "RETURN") {
      if (qty > outstanding) {
        throw new Error(
          `Cannot return more than the ${outstanding} ${item.unit} still with this booking.`
        );
      }
      nextReturned += qty;
      nextAvailable += qty;
      logAction = "INVENTORY_RETURNED";
      logSummary = `Received back ${qty} ${item.unit} of ${item.name} from ${event.description}`;
    } else if (params.action === "LOSS") {
      if (qty > outstanding) {
        throw new Error(
          `Cannot mark more than ${outstanding} ${item.unit} missing.`
        );
      }
      nextLost += qty;
      nextTotal = Math.max(0, nextTotal - qty);
      logAction = "INVENTORY_LOST";
      logSummary = `Marked ${qty} ${item.unit} of ${item.name} missing from ${event.description}`;
    } else if (params.action === "ADJUST_ISSUED") {
      const delta = qty - currentIssued;
      if (delta > item.availableQuantity) {
        throw new Error(
          `Not enough stock available to increase issued count by ${delta}.`
        );
      }
      if (qty < currentReturned + (currentLost - currentRecovered)) {
        throw new Error(
          "Issued quantity cannot be less than items already returned or marked missing."
        );
      }
      nextIssued = qty;
      nextAvailable -= delta;
      logAction = "INVENTORY_ISSUED";
      logSummary = `Adjusted given-out count of ${item.name} to ${qty} ${item.unit}`;
    } else if (params.action === "ADJUST_RETURNED") {
      if (qty > currentIssued - (currentLost - currentRecovered)) {
        throw new Error("Returned count cannot exceed given-out count.");
      }
      const delta = qty - currentReturned;
      nextReturned = qty;
      nextAvailable += delta;
      logAction = "INVENTORY_RETURNED";
      logSummary = `Adjusted returned count of ${item.name} to ${qty} ${item.unit}`;
    }

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        availableQuantity: nextAvailable,
        totalQuantity: nextTotal,
      },
    });

    const savedAlloc = await tx.eventInventory.upsert({
      where: {
        eventId_itemId: {
          eventId: params.eventId,
          itemId: params.itemId,
        },
      },
      update: {
        issuedQty: nextIssued,
        returnedQty: nextReturned,
        lostQty: nextLost,
      },
      create: {
        eventId: params.eventId,
        itemId: params.itemId,
        issuedQty: nextIssued,
        returnedQty: nextReturned,
        lostQty: nextLost,
      },
    });

    // Auto-update crockery completion status on the event
    const allEventAllocs = await tx.eventInventory.findMany({
      where: { eventId: params.eventId },
    });
    const anyIssued = allEventAllocs.some((a) => a.issuedQty > 0);
    const allSettled =
      anyIssued &&
      allEventAllocs.every(
        (a) => a.issuedQty - a.returnedQty - (a.lostQty - a.recoveredQty) <= 0
      );

    if (anyIssued) {
      await tx.event.update({
        where: { id: params.eventId },
        data: {
          crockeryStatus: allSettled ? "COMPLETED" : "PENDING",
        },
      });
    }

    return {
      event,
      item,
      savedAlloc,
      logAction,
      logSummary,
    };
  });

  await recordActivity({
    action: outcome.logAction,
    summary: outcome.logSummary,
    userId: params.actor.id,
    userName: params.actor.name,
    eventId: params.eventId,
    itemId: params.itemId,
    details: {
      itemName: outcome.item.name,
      unit: outcome.item.unit,
      quantity: qty,
      eventName: outcome.event.name,
      eventDescription: outcome.event.description,
    },
  });

  if (params.action === "LOSS" && qty > 0) {
    void (async () => {
      try {
        const admins = await db.user.findMany({
          where: { role: "ADMIN", email: { not: null } },
          select: { email: true },
        });
        const adminEmails = admins
          .map((a) => a.email)
          .filter((e): e is string => Boolean(e));
        if (adminEmails.length > 0) {
          await sendPortalEmail({
            to: adminEmails,
            subject: `Missing Store Item: ${outcome.item.name} (${qty} ${outcome.item.unit})`,
            html: buildMissingItemAlertHtml({
              eventName: outcome.event.name,
              eventDescription: outcome.event.description,
              itemName: outcome.item.name,
              quantity: qty,
              reportedBy: params.actor.name,
            }),
          });
        }
      } catch {
        // Non-blocking alert
      }
    })();
  }

  return outcome.savedAlloc;
}

export async function listMissingItems(): Promise<MissingItemRecord[]> {
  const rows = await db.eventInventory.findMany({
    where: {
      lostQty: { gt: 0 },
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          description: true,
          occasionDate: true,
        },
      },
      item: {
        select: {
          id: true,
          name: true,
          category: true,
          unit: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return rows
    .map((r) => {
      const remainingMissing = r.lostQty - r.recoveredQty;
      return {
        allocationId: r.id,
        eventId: r.event.id,
        eventName: r.event.name,
        eventDescription: r.event.description,
        occasionDate: r.event.occasionDate.toISOString(),
        itemId: r.item.id,
        itemName: r.item.name,
        category: r.item.category,
        unit: r.item.unit,
        lostQty: r.lostQty,
        recoveredQty: r.recoveredQty,
        remainingMissing,
        updatedAt: r.updatedAt.toISOString(),
      };
    })
    .filter((r) => r.remainingMissing > 0);
}

export async function resolveMissingItem(params: {
  allocationId: string;
  quantity: number;
  mode: "RECOVER" | "WRITE_OFF";
  actor: { id: string; name: string };
}): Promise<void> {
  const qty = Math.max(1, Math.round(params.quantity));

  const info = await withWriteTransaction(async (tx) => {
    const alloc = await tx.eventInventory.findUnique({
      where: { id: params.allocationId },
      include: { item: true, event: true },
    });
    if (!alloc) throw new Error("Missing item record not found.");

    const remaining = alloc.lostQty - alloc.recoveredQty;
    if (qty > remaining) {
      throw new Error(`Only ${remaining} ${alloc.item.unit} remain unresolved.`);
    }

    await tx.eventInventory.update({
      where: { id: alloc.id },
      data: {
        recoveredQty: alloc.recoveredQty + qty,
      },
    });

    if (params.mode === "RECOVER") {
      await tx.inventoryItem.update({
        where: { id: alloc.itemId },
        data: {
          totalQuantity: { increment: qty },
          availableQuantity: { increment: qty },
        },
      });
    }

    return alloc;
  });

  await recordActivity({
    action: "INVENTORY_RECOVERED",
    summary:
      params.mode === "RECOVER"
        ? `Found and restored ${qty} ${info.item.unit} of ${info.item.name} back into store`
        : `Closed missing item entry for ${qty} ${info.item.unit} of ${info.item.name} (written off)`,
    userId: params.actor.id,
    userName: params.actor.name,
    eventId: info.eventId,
    itemId: info.itemId,
    details: {
      itemName: info.item.name,
      quantity: qty,
      mode: params.mode,
    },
  });
}
