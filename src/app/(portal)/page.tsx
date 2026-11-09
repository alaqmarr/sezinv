import Link from "next/link";
import { connection } from "next/server";
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  Clock,
  MapPin,
  Package,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { db } from "@sezsec/db";
import { getAmountUnlockStatus } from "@sezsec/auth";
import {
  cn,
  formatIST,
  getISTDayBounds,
  getISTTodayString,
  getMisriDate,
  parseTimeToMinutes,
} from "@sezsec/shared";
import { canPerformAction } from "@sezsec/rbac/rbac.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { listEvents } from "@sezsec/events/events.service";
import { listMissingItems } from "@sezsec/inventory/inventory.service";
import { MisriScheduleCalendar } from "@sezsec/calendar";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  KeelArchBanner,
  StatTile,
} from "@sezsec/ui";

export default async function HomeOverviewPage() {
  await connection();
  const user = await requireServerPageAccess("/");
  const unlock = await getAmountUnlockStatus(user.id, user.canViewCharges);

  const todayKey = getISTTodayString();
  const { startOfDay } = getISTDayBounds(todayKey);
  const todayMisri = getMisriDate(todayKey);

  const [allEvents, missingItems, storeAgg] = await Promise.all([
    listEvents({ amountsUnlocked: unlock.unlocked }),
    listMissingItems(),
    db.inventoryItem.findMany({
      select: { totalQuantity: true, availableQuantity: true },
    }),
  ]);

  const todaysFunctions = allEvents
    .filter(
      (e) =>
        e.status !== "CANCELLED" &&
        formatIST(e.occasionDate, "yyyy-MM-dd") === todayKey
    )
    .sort(
      (a, b) =>
        parseTimeToMinutes(a.occasionTime) - parseTimeToMinutes(b.occasionTime)
    );

  const upcomingFunctions = allEvents.filter(
    (e) =>
      e.status === "BOOKED" &&
      new Date(e.occasionDate).getTime() >= startOfDay.getTime()
  );

  const itemsCurrentlyOut = storeAgg.reduce(
    (sum, i) => sum + Math.max(0, i.totalQuantity - i.availableQuantity),
    0
  );

  const canCreate = canPerformAction("event:create", user.role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <KeelArchBanner
          arabicTitle="بسم الله الرحمن الرحيم"
          subtitle={`${todayMisri.formattedEn} • Anjuman-e-Mohammedi, Secunderabad`}
          className="flex-1 text-left sm:text-center"
        />
        {canCreate ? (
          <Link href="/events/new" className="self-start sm:self-center shrink-0">
            <Button
              variant="primary"
              size="lg"
              leftIcon={<CalendarPlus className="h-4 w-4" />}
            >
              Book a Hall
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Today's Functions"
          value={todaysFunctions.length}
          hint={formatIST(todayKey, "dd MMM yyyy")}
          icon={<CalendarCheck className="h-5 w-5" />}
          tone="maroon"
        />
        <StatTile
          label="Upcoming Bookings"
          value={upcomingFunctions.length}
          hint="Active hall & home bookings"
          icon={<Sparkles className="h-5 w-5" />}
          tone="brass"
        />
        <StatTile
          label="Store Vessels Currently Out"
          value={itemsCurrentlyOut}
          hint="Issued to functions & pending return"
          icon={<Package className="h-5 w-5" />}
          tone="sage"
        />
        <StatTile
          label="Missing Items to Resolve"
          value={missingItems.reduce((s, m) => s + m.remainingMissing, 0)}
          hint={`${missingItems.length} open item entries`}
          icon={<AlertCircle className="h-5 w-5" />}
          tone={missingItems.length > 0 ? "crimson" : "default"}
        />
      </div>

      {todaysFunctions.length > 0 ? (
        <Card accentTop>
          <CardHeader
            title="Today's Scheduled Functions"
            subtitle="Halls, timings, and caterer/decorator overview for today"
            arabicRight={todayMisri.formattedAr}
          />
          <CardBody
            className={cn(
              "grid grid-cols-1 gap-4",
              todaysFunctions.length > 1 ? "md:grid-cols-2" : ""
            )}
          >
            {todaysFunctions.map((ev) => (
              <Link
                key={ev.id}
                href={`/events/${encodeURIComponent(ev.id)}`}
                className="group flex flex-col justify-between gap-3 rounded-2xl border border-[#D9C398] bg-[#FBF6EB]/65 p-4 transition-all hover:border-[#B8924A] hover:bg-[#FBF6EB] sm:flex-row sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-[#231917] group-hover:text-[#6A1B1B]">
                      {ev.description}
                    </h4>
                    <Badge tone="maroon">{ev.thaalCount} Thaals</Badge>
                    {ev.razaGranted ? (
                      <Badge tone="sage">Raza Confirmed</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-[#5E4F4A]">
                    {ev.name} • {ev.mobile}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5 text-xs text-[#4A3B36]">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Clock className="h-3.5 w-3.5 text-[#6A1B1B]" />
                      {ev.occasionTime}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-[#6A1B1B]" />
                      {ev.halls.join(", ") || "Self"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-[#8A6421]" />
                      Caterer: <strong>{ev.catererName || "Self"}</strong>
                    </span>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 self-start rounded-xl border border-[#D9C398] bg-white px-3 py-1.5 text-xs font-semibold text-[#6A1B1B] shadow-2xs transition-colors group-hover:bg-[#6A1B1B] group-hover:text-white sm:self-center shrink-0">
                  Open Details
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <MisriScheduleCalendar events={allEvents} canCreateEvent={canCreate} />
    </div>
  );
}
