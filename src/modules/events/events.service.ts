import crypto from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db, withWriteTransaction } from "@sezsec/db";
import {
  formatIST,
  formatTimeDisplay,
  getISTDayBounds,
  isSelfEventVenue,
  normalizeHallList,
  parseISTEventDateTime,
  slugify,
} from "@sezsec/shared";
import {
  applyAmountRedaction,
  calculateEventAmounts,
} from "@sezsec/finance/finance.helper";
import { recordActivity } from "@sezsec/logs";
import {
  buildBookingConfirmationHtml,
  generateEventIcs,
  sendPortalEmail,
} from "@sezsec/notifications";
import type { EventBookingInput } from "./events.schema";
import type {
  CrockeryStatusType,
  EventStatusType,
  EventVisibilityType,
  PortalEvent,
} from "./events.types";

function parseHallCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) {
      out[k] = Math.round(n);
    }
  }
  return out;
}

function generateBookingReference(dateKey: string): string {
  const compactDate = dateKey.replace(/-/g, "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `SEZ-${compactDate}-${suffix}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapEventRowToPortalEvent(row: any, amountsUnlocked: boolean): PortalEvent {
  const halls = normalizeHallList(row.hall);
  const redacted = applyAmountRedaction(row, amountsUnlocked);

  return {
    id: row.id,
    reference: row.reference ?? null,
    name: row.name,
    mobile: row.mobile,
    email: row.email ?? null,
    occasionDate:
      row.occasionDate instanceof Date
        ? row.occasionDate.toISOString()
        : String(row.occasionDate),
    occasionDay: row.occasionDay ?? null,
    occasionTime: row.occasionTime
      ? formatTimeDisplay(String(row.occasionTime))
      : "",
    description: row.description,
    halls,
    hallCounts: parseHallCounts(row.hallCounts),

    catererName: row.catererName || "Self",
    catererPhone: row.catererPhone || "",
    catererId: row.catererId ?? null,

    decoratorName: row.decoratorName ?? null,
    decoratorPhone: row.decoratorPhone ?? null,
    decoratorId: row.decoratorId ?? null,

    thaalCount: row.thaalCount ?? 0,
    totalThaalsDone: row.totalThaalsDone ?? null,
    sarkariThaalSet: row.sarkariThaalSet ?? 0,
    bhaiSaabIzzan: Boolean(row.bhaiSaabIzzan),
    muraqebeenIzzan: Boolean(row.muraqebeenIzzan),
    benSaabIzzan: Boolean(row.benSaabIzzan),
    extraChilamchiLota: row.extraChilamchiLota ?? 0,
    tablesAndChairs: row.tablesAndChairs ?? 0,
    mic: Boolean(row.mic),
    crockeryRequired: Boolean(row.crockeryRequired),
    thaalForDevri: Boolean(row.thaalForDevri),
    paat: Boolean(row.paat),
    masjidLight: Boolean(row.masjidLight),
    crockeryStatus: (row.crockeryStatus || "NOT_REQUIRED") as CrockeryStatusType,

    acStartTime: row.acStartTime
      ? formatTimeDisplay(String(row.acStartTime))
      : null,
    partyTime: row.partyTime
      ? formatTimeDisplay(String(row.partyTime))
      : null,
    decorations: Boolean(row.decorations),
    gasCount: row.gasCount ?? null,
    menu: row.menu ?? null,

    status: (row.status || "BOOKED") as EventStatusType,
    eventType: (row.eventType || "PRIVATE") as EventVisibilityType,
    razaGranted: Boolean(row.razaGranted),
    paymentMode: row.paymentMode ?? null,
    transactionId: row.transactionId ?? null,
    refundedDate:
      row.refundedDate instanceof Date
        ? row.refundedDate.toISOString()
        : row.refundedDate ?? null,

    thaalRate: redacted.thaalRate,
    thaalAmount: redacted.thaalAmount,
    sarkariRate: redacted.sarkariRate,
    sarkariAmount: redacted.sarkariAmount,
    kitchenCharge: redacted.kitchenCharge,
    decorationCharge: redacted.decorationCharge,
    otherCharge: redacted.otherCharge,
    hallCharges: redacted.hallCharges,
    totalAmount: redacted.totalAmount,
    depositAmount: redacted.depositAmount,
    depositStatus: redacted.depositStatus,
    amountNotes: redacted.amountNotes,
    amountsLocked: redacted.amountsLocked,

    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : String(row.updatedAt),
    createdById: row.createdById ?? null,
    createdByName: row.createdBy?.name || row.createdBy?.username || null,
    allocations: Array.isArray(row.inventoryAllocations)
      ? row.inventoryAllocations.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (alloc: any) => ({
            id: alloc.id,
            itemId: alloc.itemId,
            itemName: alloc.item?.name || "Unknown Item",
            category: alloc.item?.category || "General",
            unit: alloc.item?.unit || "pcs",
            issuedQty: alloc.issuedQty,
            returnedQty: alloc.returnedQty,
            lostQty: alloc.lostQty,
            recoveredQty: alloc.recoveredQty,
          })
        )
      : undefined,
  };
}

export async function listEvents(options: {
  amountsUnlocked: boolean;
  fromDate?: string;
  toDate?: string;
  status?: string;
  search?: string;
  sortDir?: "desc" | "asc";
}): Promise<PortalEvent[]> {
  const where: Prisma.EventWhereInput = {};
  const sortDir = options.sortDir === "asc" ? "asc" : "desc";

  if (options.fromDate || options.toDate) {
    where.occasionDate = {};
    if (options.fromDate) {
      where.occasionDate.gte = getISTDayBounds(options.fromDate).startOfDay;
    }
    if (options.toDate) {
      where.occasionDate.lte = getISTDayBounds(options.toDate).endOfDay;
    }
  }

  if (options.status && options.status !== "ALL") {
    where.status = options.status as EventStatusType;
  }

  if (options.search?.trim()) {
    const q = options.search.trim();
    where.OR = [
      { name: { contains: q } },
      { mobile: { contains: q } },
      { email: { contains: q } },
      { description: { contains: q } },
      { reference: { contains: q } },
      { catererName: { contains: q } },
      { catererPhone: { contains: q } },
      { decoratorName: { contains: q } },
      { decoratorPhone: { contains: q } },
      { menu: { contains: q } },
    ];
  }

  const rows = await db.event.findMany({
    where,
    include: {
      createdBy: { select: { name: true, username: true } },
    },
    orderBy: [{ occasionDate: sortDir }, { createdAt: "desc" }],
  });

  return rows.map((r) => mapEventRowToPortalEvent(r, options.amountsUnlocked));
}

export async function getEventById(
  id: string,
  amountsUnlocked: boolean
): Promise<PortalEvent | null> {
  const row = await db.event.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true, username: true } },
      inventoryAllocations: {
        include: {
          item: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!row) return null;
  return mapEventRowToPortalEvent(row, amountsUnlocked);
}

export async function createEventBooking(
  input: EventBookingInput,
  actor: { id: string; name: string },
  amountsUnlocked: boolean
): Promise<PortalEvent> {
  const { dateKey } = getISTDayBounds(input.occasionDate);
  const formattedTime = formatTimeDisplay(input.occasionTime);
  const eventDateTime = parseISTEventDateTime(input.occasionDate, formattedTime);
  const occasionDay = formatIST(eventDateTime, "EEEE");
  const isSelfVenue = isSelfEventVenue(input.halls);

  const amounts = calculateEventAmounts({
    thaalCount: input.thaalCount,
    sarkariThaalSet: input.sarkariThaalSet,
    thaalRate: input.thaalRate,
    thaalAmount: input.thaalAmount,
    sarkariRate: input.sarkariRate,
    sarkariAmount: input.sarkariAmount,
    kitchenCharge: input.kitchenCharge,
    decorationCharge: input.decorationCharge,
    otherCharge: input.otherCharge,
    hallCharges: input.hallCharges,
    depositAmount: input.depositAmount,
    depositStatus: input.depositStatus,
    amountNotes: input.amountNotes,
  });

  const compactDate = dateKey.replace(/-/g, "");
  const slug = slugify(input.description || input.name) || "event";
  const baseId = `${compactDate}-${input.mobile.replace(/\D/g, "").slice(-10)}-${slug}-${crypto.randomBytes(2).toString("hex")}`;
  const reference = generateBookingReference(dateKey);

  const created = await withWriteTransaction(async (tx) => {
    // Auto-save new Decorator in Decorators directory if decorations & non-self
    let decoratorId = input.decoratorId || null;
    const decoratorName =
      input.decorations && !isSelfVenue ? input.decoratorName?.trim() || null : null;
    const decoratorPhone =
      input.decorations && !isSelfVenue ? input.decoratorPhone?.trim() || null : null;

    if (decoratorName && decoratorPhone && !decoratorId) {
      const savedDecorator = await tx.decorator.upsert({
        where: { name: decoratorName },
        update: { phone: decoratorPhone },
        create: { name: decoratorName, phone: decoratorPhone },
      });
      decoratorId = savedDecorator.id;
    }

    // Auto-save non-Self Caterer in Caterers directory
    let catererId = input.catererId || null;
    const catererName = input.catererName?.trim() || "Self";
    const catererPhone = input.catererPhone?.trim() || "";
    if (
      catererName &&
      catererName.toLowerCase() !== "self" &&
      catererPhone &&
      !catererId
    ) {
      const savedCaterer = await tx.caterer.upsert({
        where: { name: catererName },
        update: { phone: catererPhone },
        create: { name: catererName, phone: catererPhone },
      });
      catererId = savedCaterer.id;
    }

    return tx.event.create({
      data: {
        id: baseId,
        reference,
        name: input.name.trim(),
        mobile: input.mobile.trim(),
        email: input.email?.trim() || null,
        occasionDate: eventDateTime,
        occasionDay,
        occasionTime: formattedTime,
        description: input.description.trim(),
        hall: input.halls as Prisma.InputJsonValue,
        hallCounts: (input.hallCounts || {}) as Prisma.InputJsonValue,

        catererName,
        catererPhone,
        catererId,

        decorations: Boolean(input.decorations),
        decoratorName,
        decoratorPhone,
        decoratorId,

        thaalCount: input.thaalCount,
        totalThaalsDone: input.totalThaalsDone ?? null,
        sarkariThaalSet: input.sarkariThaalSet,
        bhaiSaabIzzan: input.bhaiSaabIzzan,
        muraqebeenIzzan: input.muraqebeenIzzan,
        benSaabIzzan: input.benSaabIzzan,
        extraChilamchiLota: input.extraChilamchiLota,
        tablesAndChairs: input.tablesAndChairs,
        mic: input.mic,
        crockeryRequired: input.crockeryRequired,
        thaalForDevri: input.thaalForDevri,
        paat: input.paat,
        masjidLight: input.masjidLight,
        crockeryStatus: input.crockeryRequired ? "PENDING" : "NOT_REQUIRED",

        acStartTime: input.acStartTime?.trim()
          ? formatTimeDisplay(input.acStartTime)
          : null,
        partyTime: input.partyTime?.trim()
          ? formatTimeDisplay(input.partyTime)
          : null,
        gasCount: input.gasCount ?? null,
        menu: input.menu?.trim() || null,

        status: input.status || "BOOKED",
        eventType: input.eventType || "PRIVATE",
        razaGranted: Boolean(input.razaGranted),

        thaalRate: amounts.thaalRate,
        thaalAmount: amounts.thaalAmount,
        sarkariRate: amounts.sarkariRate,
        sarkariAmount: amounts.sarkariAmount,
        kitchenCharge: amounts.kitchenCharge,
        decorationCharge: amounts.decorationCharge,
        otherCharge: amounts.otherCharge,
        hallCharges: amounts.hallCharges as Prisma.InputJsonValue,
        totalAmount: amounts.totalAmount,
        depositAmount: amounts.depositAmount,
        depositStatus: amounts.depositStatus,
        amountNotes: amounts.amountNotes,
        paymentMode: input.paymentMode || null,
        transactionId: input.transactionId || null,
        refundedDate: amounts.depositStatus === "REFUNDED" ? new Date() : null,

        createdById: actor.id,
      },
      include: {
        createdBy: { select: { name: true, username: true } },
      },
    });
  });

  await recordActivity({
    action: "EVENT_CREATED",
    summary: `Booked ${input.description} for ${input.name} on ${formatIST(created.occasionDate, "dd MMM yyyy")}`,
    userId: actor.id,
    userName: actor.name,
    eventId: created.id,
    details: {
      reference: created.reference,
      halls: input.halls,
      thaalCount: input.thaalCount,
    },
  });

  // Fire-and-forget confirmation email (never includes financial figures)
  void (async () => {
    try {
      const admins = await db.user.findMany({
        where: { role: "ADMIN", email: { not: null } },
        select: { email: true },
      });
      const adminEmails = admins
        .map((a) => a.email)
        .filter((e): e is string => Boolean(e));

      const toList = created.email ? [created.email] : adminEmails;
      if (toList.length === 0) return;

      const icsContent = generateEventIcs({
        id: created.id,
        name: created.name,
        description: created.description,
        occasionDate: created.occasionDate,
        occasionTime: created.occasionTime,
        halls: input.halls,
      });

      await sendPortalEmail({
        to: toList,
        bcc: created.email && adminEmails.length > 0 ? adminEmails : undefined,
        subject: `Hall Booking Recorded: ${created.description} (${formatIST(created.occasionDate, "dd MMM yyyy")})`,
        html: buildBookingConfirmationHtml({
          id: created.id,
          reference: created.reference,
          name: created.name,
          mobile: created.mobile,
          description: created.description,
          occasionDate: created.occasionDate,
          occasionTime: created.occasionTime,
          halls: input.halls,
          thaalCount: created.thaalCount,
          catererName: created.catererName,
          decoratorName: created.decoratorName,
        }),
        attachments: [
          {
            filename: "booking.ics",
            content: icsContent,
            contentType: "text/calendar",
          },
        ],
      });
    } catch {
      // Non-blocking notification
    }
  })();

  return mapEventRowToPortalEvent(created, amountsUnlocked);
}

export async function updateEventBooking(
  eventId: string,
  input: EventBookingInput,
  actor: { id: string; name: string },
  amountsUnlocked: boolean
): Promise<PortalEvent> {
  const formattedTime = formatTimeDisplay(input.occasionTime);
  const eventDateTime = parseISTEventDateTime(input.occasionDate, formattedTime);
  const occasionDay = formatIST(eventDateTime, "EEEE");
  const isSelfVenue = isSelfEventVenue(input.halls);

  const updated = await withWriteTransaction(async (tx) => {
    const existing = await tx.event.findUnique({ where: { id: eventId } });
    if (!existing) {
      throw new Error("Booking not found.");
    }

    let decoratorId = input.decoratorId || null;
    const decoratorName =
      input.decorations && !isSelfVenue ? input.decoratorName?.trim() || null : null;
    const decoratorPhone =
      input.decorations && !isSelfVenue ? input.decoratorPhone?.trim() || null : null;

    if (decoratorName && decoratorPhone && !decoratorId) {
      const savedDecorator = await tx.decorator.upsert({
        where: { name: decoratorName },
        update: { phone: decoratorPhone },
        create: { name: decoratorName, phone: decoratorPhone },
      });
      decoratorId = savedDecorator.id;
    }

    const dataToUpdate: Prisma.EventUncheckedUpdateInput = {
      name: input.name.trim(),
      mobile: input.mobile.trim(),
      email: input.email?.trim() || null,
      occasionDate: eventDateTime,
      occasionDay,
      occasionTime: formattedTime,
      description: input.description.trim(),
      hall: input.halls as Prisma.InputJsonValue,
      hallCounts: (input.hallCounts || {}) as Prisma.InputJsonValue,

      catererName: input.catererName?.trim() || "Self",
      catererPhone: input.catererPhone?.trim() || "",

      decorations: Boolean(input.decorations),
      decoratorName,
      decoratorPhone,
      decoratorId: input.decorations && !isSelfVenue ? decoratorId : null,

      thaalCount: input.thaalCount,
      totalThaalsDone: input.totalThaalsDone ?? existing.totalThaalsDone,
      sarkariThaalSet: input.sarkariThaalSet,
      bhaiSaabIzzan: input.bhaiSaabIzzan,
      muraqebeenIzzan: input.muraqebeenIzzan,
      benSaabIzzan: input.benSaabIzzan,
      extraChilamchiLota: input.extraChilamchiLota,
      tablesAndChairs: input.tablesAndChairs,
      mic: input.mic,
      crockeryRequired: input.crockeryRequired,
      thaalForDevri: input.thaalForDevri,
      paat: input.paat,
      masjidLight: input.masjidLight,
      crockeryStatus:
        input.crockeryStatus ??
        (input.crockeryRequired
          ? existing.crockeryStatus === "COMPLETED"
            ? "COMPLETED"
            : "PENDING"
          : "NOT_REQUIRED"),

      acStartTime: input.acStartTime?.trim()
        ? formatTimeDisplay(input.acStartTime)
        : null,
      partyTime: input.partyTime?.trim()
        ? formatTimeDisplay(input.partyTime)
        : null,
      gasCount: input.gasCount ?? null,
      menu: input.menu?.trim() || null,

      status: input.status || existing.status,
      eventType: input.eventType || existing.eventType,
      razaGranted: Boolean(input.razaGranted),
    };

    // Recompute Thaal/Sarkari total if rate already exists and counts changed, or if amountsUnlocked & provided
    if (amountsUnlocked && input.thaalRate !== undefined) {
      const amounts = calculateEventAmounts({
        thaalCount: input.thaalCount,
        sarkariThaalSet: input.sarkariThaalSet,
        thaalRate: input.thaalRate,
        thaalAmount: input.thaalAmount,
        sarkariRate: input.sarkariRate,
        sarkariAmount: input.sarkariAmount,
        kitchenCharge: input.kitchenCharge,
        decorationCharge: input.decorationCharge,
        otherCharge: input.otherCharge,
        hallCharges: input.hallCharges,
        depositAmount: input.depositAmount,
        depositStatus: input.depositStatus,
        amountNotes: input.amountNotes,
      });
      dataToUpdate.thaalRate = amounts.thaalRate;
      dataToUpdate.thaalAmount = amounts.thaalAmount;
      dataToUpdate.sarkariRate = amounts.sarkariRate;
      dataToUpdate.sarkariAmount = amounts.sarkariAmount;
      dataToUpdate.kitchenCharge = amounts.kitchenCharge;
      dataToUpdate.decorationCharge = amounts.decorationCharge;
      dataToUpdate.otherCharge = amounts.otherCharge;
      dataToUpdate.hallCharges = amounts.hallCharges as Prisma.InputJsonValue;
      dataToUpdate.totalAmount = amounts.totalAmount;
      dataToUpdate.depositAmount = amounts.depositAmount;
      dataToUpdate.depositStatus = amounts.depositStatus;
      dataToUpdate.amountNotes = amounts.amountNotes;
    } else if (existing.thaalRate > 0 || existing.sarkariRate > 0) {
      const recalculated = calculateEventAmounts({
        thaalCount: input.thaalCount,
        sarkariThaalSet: input.sarkariThaalSet,
        thaalRate: existing.thaalRate,
        thaalAmount: existing.thaalAmount,
        sarkariRate: existing.sarkariRate,
        sarkariAmount: existing.sarkariAmount,
        kitchenCharge: existing.kitchenCharge,
        decorationCharge: existing.decorationCharge,
        otherCharge: existing.otherCharge,
        hallCharges: existing.hallCharges as Record<string, number> | null,
        depositAmount: existing.depositAmount,
        depositStatus: existing.depositStatus,
        amountNotes: existing.amountNotes,
      });
      dataToUpdate.thaalAmount = recalculated.thaalAmount;
      dataToUpdate.sarkariAmount = recalculated.sarkariAmount;
      dataToUpdate.totalAmount = recalculated.totalAmount;
    }

    return tx.event.update({
      where: { id: eventId },
      data: dataToUpdate,
      include: {
        createdBy: { select: { name: true, username: true } },
      },
    });
  });

  await recordActivity({
    action: updated.status === "CANCELLED" ? "EVENT_CANCELLED" : "EVENT_UPDATED",
    summary:
      updated.status === "CANCELLED"
        ? `Cancelled booking: ${updated.description} (${updated.name})`
        : `Updated booking details for ${updated.description} (${updated.name})`,
    userId: actor.id,
    userName: actor.name,
    eventId: updated.id,
  });

  return mapEventRowToPortalEvent(updated, amountsUnlocked);
}

export async function updateEventCharges(
  eventId: string,
  payload: {
    thaalRate?: number;
    thaalAmount?: number;
    sarkariRate?: number;
    sarkariAmount?: number;
    kitchenCharge?: number;
    decorationCharge?: number;
    otherCharge?: number;
    hallCharges?: Record<string, number>;
    depositAmount?: number;
    depositStatus?: string;
    paymentMode?: string | null;
    transactionId?: string | null;
    amountNotes?: string | null;
  },
  actor: { id: string; name: string }
): Promise<PortalEvent> {
  const updated = await withWriteTransaction(async (tx) => {
    const existing = await tx.event.findUnique({ where: { id: eventId } });
    if (!existing) {
      throw new Error("Booking not found.");
    }

    const amounts = calculateEventAmounts({
      thaalCount: existing.thaalCount,
      sarkariThaalSet: existing.sarkariThaalSet,
      thaalRate: payload.thaalRate ?? existing.thaalRate,
      thaalAmount: payload.thaalAmount ?? existing.thaalAmount,
      sarkariRate: payload.sarkariRate ?? existing.sarkariRate,
      sarkariAmount: payload.sarkariAmount ?? existing.sarkariAmount,
      kitchenCharge: payload.kitchenCharge ?? existing.kitchenCharge,
      decorationCharge: payload.decorationCharge ?? existing.decorationCharge,
      otherCharge: payload.otherCharge ?? existing.otherCharge,
      hallCharges:
        payload.hallCharges ??
        (existing.hallCharges as Record<string, number> | null),
      depositAmount: payload.depositAmount ?? existing.depositAmount,
      depositStatus: payload.depositStatus ?? existing.depositStatus,
      amountNotes:
        payload.amountNotes !== undefined
          ? payload.amountNotes
          : existing.amountNotes,
    });

    return tx.event.update({
      where: { id: eventId },
      data: {
        thaalRate: amounts.thaalRate,
        thaalAmount: amounts.thaalAmount,
        sarkariRate: amounts.sarkariRate,
        sarkariAmount: amounts.sarkariAmount,
        kitchenCharge: amounts.kitchenCharge,
        decorationCharge: amounts.decorationCharge,
        otherCharge: amounts.otherCharge,
        hallCharges: amounts.hallCharges as Prisma.InputJsonValue,
        totalAmount: amounts.totalAmount,
        depositAmount: amounts.depositAmount,
        depositStatus: amounts.depositStatus,
        amountNotes: amounts.amountNotes,
        paymentMode:
          payload.paymentMode !== undefined
            ? payload.paymentMode || null
            : existing.paymentMode,
        transactionId:
          payload.transactionId !== undefined
            ? payload.transactionId || null
            : existing.transactionId,
        refundedDate:
          amounts.depositStatus === "REFUNDED"
            ? existing.refundedDate || new Date()
            : null,
      },
      include: {
        createdBy: { select: { name: true, username: true } },
      },
    });
  });

  await recordActivity({
    action: "AMOUNT_UPDATED",
    summary: `Updated charges & payment info for ${updated.description} (${updated.name})`,
    userId: actor.id,
    userName: actor.name,
    eventId: updated.id,
  });

  return mapEventRowToPortalEvent(updated, true);
}

export async function lookupBookersByMobile(mobileQuery: string): Promise<
  Array<{
    name: string;
    mobile: string;
    email: string | null;
  }>
> {
  const q = mobileQuery.trim();
  if (q.length < 3) return [];

  const matches = await db.event.findMany({
    where: {
      mobile: { contains: q },
    },
    select: {
      name: true,
      mobile: true,
      email: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const seen = new Set<string>();
  const unique: Array<{ name: string; mobile: string; email: string | null }> = [];
  for (const m of matches) {
    const key = `${m.mobile}-${m.name.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
      if (unique.length >= 6) break;
    }
  }
  return unique;
}
