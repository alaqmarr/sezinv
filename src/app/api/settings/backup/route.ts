import * as XLSX from "xlsx";
import { connection, NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db, withWriteTransaction } from "@sezsec/db";
import { getAmountUnlockStatus } from "@sezsec/auth";
import {
  formatIST,
  formatTimeDisplay,
  normalizeHallList,
} from "@sezsec/shared";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import { recordActivity } from "@sezsec/logs";

export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const format = sp.get("format") || "xlsx";
  const dataset = sp.get("dataset") || "events";
  const from = sp.get("from");
  const to = sp.get("to");

  const unlock = await getAmountUnlockStatus(
    auth.user.id,
    auth.user.canViewCharges
  );

  if (format === "json") {
    if (auth.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Full backup download is restricted to Administrators." },
        { status: 403 }
      );
    }

    const [halls, caterers, decorators, inventory, events, eventInventory, config] =
      await Promise.all([
        db.hall.findMany(),
        db.caterer.findMany(),
        db.decorator.findMany(),
        db.inventoryItem.findMany(),
        db.event.findMany({
          orderBy: [{ occasionDate: "desc" }, { createdAt: "desc" }],
        }),
        db.eventInventory.findMany(),
        db.config.findMany({
          where: { key: { not: "smtpPassword" } },
        }),
      ]);

    const safeEvents = events.map((ev) =>
      unlock.unlocked
        ? ev
        : {
            ...ev,
            thaalRate: null,
            thaalAmount: null,
            sarkariRate: null,
            sarkariAmount: null,
            kitchenCharge: null,
            decorationCharge: null,
            otherCharge: null,
            hallCharges: null,
            totalAmount: null,
            depositAmount: null,
          }
    );

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      amountsIncluded: unlock.unlocked,
      halls,
      caterers,
      decorators,
      inventory,
      events: safeEvents,
      eventInventory,
      config,
    });
  }

  // Excel spreadsheet export
  const wb = XLSX.utils.book_new();

  if (dataset === "events" || dataset === "all") {
    const where: Prisma.EventWhereInput = {};
    if (from || to) {
      where.occasionDate = {};
      if (from) where.occasionDate.gte = new Date(`${from}T00:00:00+05:30`);
      if (to) where.occasionDate.lte = new Date(`${to}T23:59:59+05:30`);
    }
    const events = await db.event.findMany({
      where,
      orderBy: [{ occasionDate: "desc" }, { createdAt: "desc" }],
    });

    const rows = events.map((ev) => {
      const base: Record<string, unknown> = {
        "Booking Ref": ev.reference || ev.id,
        Date: formatIST(ev.occasionDate, "dd-MM-yyyy"),
        Time: ev.occasionTime ? formatTimeDisplay(ev.occasionTime) : "",
        "Booker Name": ev.name,
        Mobile: ev.mobile,
        Occasion: ev.description,
        Halls: normalizeHallList(ev.hall).join(", "),
        Thaals: ev.thaalCount,
        "Thaals Served": ev.totalThaalsDone ?? "",
        "Sarkari Sets": ev.sarkariThaalSet,
        Caterer: ev.catererName,
        "Caterer Phone": ev.catererPhone,
        Decorations: ev.decorations ? "Yes" : "No",
        Decorator: ev.decoratorName || "",
        "Decorator Phone": ev.decoratorPhone || "",
        Status: ev.status,
      };
      if (unlock.unlocked) {
        base["Total Charges (Rs)"] = ev.totalAmount;
        base["Refundable Deposit (Rs)"] = ev.depositAmount;
        base["Deposit Status"] = ev.depositStatus;
        base["Payment Method"] = ev.paymentMode || "";
      }
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Bookings");
  }

  if (dataset === "inventory" || dataset === "all") {
    const items = await db.inventoryItem.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    const rows = items.map((i) => ({
      "Item Name": i.name,
      Category: i.category,
      "Total Stock": i.totalQuantity,
      "Currently in Store": i.availableQuantity,
      "Currently Out": i.totalQuantity - i.availableQuantity,
      Unit: i.unit,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Store Stock");
  }

  if (dataset === "ledger" || dataset === "all") {
    const logs = await db.activityLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 1000,
    });
    const rows = logs.map((l) => ({
      "Date & Time": formatIST(l.timestamp, "dd-MM-yyyy hh:mm a"),
      Activity: l.summary,
      "Recorded By": l.userName,
      Category: l.action,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Activity History");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="jamaat-records-${dataset}-${formatIST(new Date(), "yyyyMMdd")}.xlsx"`,
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const backup = await request.json();
    await withWriteTransaction(async (tx) => {
      if (Array.isArray(backup?.halls)) {
        for (const h of backup.halls) {
          if (!h?.name) continue;
          await tx.hall.upsert({
            where: { name: String(h.name) },
            update: { width: h.width ?? null, length: h.length ?? null },
            create: {
              name: String(h.name),
              width: h.width ?? null,
              length: h.length ?? null,
            },
          });
        }
      }
      if (Array.isArray(backup?.caterers)) {
        for (const c of backup.caterers) {
          if (!c?.name) continue;
          await tx.caterer.upsert({
            where: { name: String(c.name) },
            update: { phone: String(c.phone || "") },
            create: { name: String(c.name), phone: String(c.phone || "") },
          });
        }
      }
      if (Array.isArray(backup?.decorators)) {
        for (const d of backup.decorators) {
          if (!d?.name) continue;
          await tx.decorator.upsert({
            where: { name: String(d.name) },
            update: { phone: String(d.phone || "") },
            create: { name: String(d.name), phone: String(d.phone || "") },
          });
        }
      }
      if (Array.isArray(backup?.inventory)) {
        for (const item of backup.inventory) {
          if (!item?.id || !item?.name) continue;
          await tx.inventoryItem.upsert({
            where: { id: String(item.id) },
            update: {
              name: String(item.name),
              category: String(item.category || "General"),
              totalQuantity: Number(item.totalQuantity || 0),
              availableQuantity: Number(item.availableQuantity || 0),
              unit: String(item.unit || "pcs"),
            },
            create: {
              id: String(item.id),
              name: String(item.name),
              category: String(item.category || "General"),
              totalQuantity: Number(item.totalQuantity || 0),
              availableQuantity: Number(item.availableQuantity || 0),
              unit: String(item.unit || "pcs"),
            },
          });
        }
      }
    });

    await recordActivity({
      action: "STOCK_ADDED",
      summary: "Restored office backup records from file",
      userId: auth.user.id,
      userName: auth.user.name || auth.user.username,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not restore backup file.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
