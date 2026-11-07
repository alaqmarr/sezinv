import { connection, NextResponse, type NextRequest } from "next/server";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { setBookingPrintUnlockCookie } from "@sezsec/auth/booking-print-unlock.helper";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import { eventBookingSchema } from "@sezsec/events";
import {
  createEventBooking,
  listEvents,
} from "@sezsec/events/events.service";

export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const unlock = await getAmountUnlockStatus(auth.user.id);
  const sp = request.nextUrl.searchParams;

  const sortParam = sp.get("sort");
  const sortDir = sortParam === "asc" ? "asc" : "desc";

  const allEvents = await listEvents({
    amountsUnlocked: unlock.unlocked,
    fromDate: sp.get("from") || undefined,
    toDate: sp.get("to") || undefined,
    status: sp.get("status") || undefined,
    search: sp.get("q") || sp.get("search") || undefined,
    sortDir,
  });

  const pageParam = sp.get("page");
  const pageSizeParam = sp.get("pageSize");
  if (pageParam) {
    const pageSize = Math.min(100, Math.max(1, Number(pageSizeParam) || 25));
    const total = allEvents.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, Number(pageParam) || 1), totalPages);
    const start = (page - 1) * pageSize;
    const events = allEvents.slice(start, start + pageSize);

    return NextResponse.json({
      events,
      total,
      page,
      pageSize,
      totalPages,
      amountsUnlocked: unlock.unlocked,
    });
  }

  return NextResponse.json({
    events: allEvents,
    total: allEvents.length,
    amountsUnlocked: unlock.unlocked,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const raw = await request.json();
    const parsed = eventBookingSchema.safeParse(raw);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message || "Please check the booking details." },
        { status: 400 }
      );
    }

    const created = await createEventBooking(
      parsed.data,
      {
        id: auth.user.id,
        name: auth.user.name || auth.user.username,
      },
      true
    );

    const printUnlockExpiresAt = await setBookingPrintUnlockCookie(
      auth.user.id,
      created.id
    );

    return NextResponse.json(
      { ok: true, event: created, printUnlockExpiresAt },
      { status: 201 }
    );
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not create booking.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
