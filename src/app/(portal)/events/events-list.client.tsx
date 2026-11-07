"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownWideNarrow,
  CalendarPlus,
  Clock,
  Lock,
  MapPin,
  Package,
  Printer,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  formatIST,
  formatRupees,
  getISTDayBounds,
  getISTTodayString,
  getMisriDate,
  isSelfEventVenue,
} from "@sezsec/shared";
import type { PortalEvent } from "@sezsec/events";
import { AmountAccessBar } from "@sezsec/finance";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  PaginationBar,
  Tabs,
} from "@sezsec/ui";

type BookingSortMode = "date_desc" | "date_asc" | "created_desc";

export function EventsListClient({
  events,
  amountsUnlocked,
  canCreate,
  canManageVessels,
}: {
  events: PortalEvent[];
  amountsUnlocked: boolean;
  canCreate: boolean;
  canManageVessels: boolean;
}) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [hallFilter, setHallFilter] = useState("ALL");
  const [sortMode, setSortMode] = useState<BookingSortMode>("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const todayStart = useMemo(
    () => getISTDayBounds(getISTTodayString()).startOfDay.getTime(),
    []
  );

  const hallOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      for (const h of ev.halls) {
        if (h.trim()) set.add(h.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const tabCounts = useMemo(() => {
    let upcoming = 0;
    let past = 0;
    let cancelled = 0;
    for (const ev of events) {
      const ts = new Date(ev.occasionDate).getTime();
      if (ev.status === "CANCELLED") {
        cancelled++;
      } else if (ts >= todayStart) {
        upcoming++;
      }
      if (ts < todayStart && ev.status !== "CANCELLED") {
        past++;
      }
    }
    return {
      all: events.length,
      upcoming,
      past,
      cancelled,
    };
  }, [events, todayStart]);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();

    const matches = events.filter((ev) => {
      const evTime = new Date(ev.occasionDate).getTime();
      if (tab === "upcoming") {
        if (ev.status === "CANCELLED" || evTime < todayStart) return false;
      } else if (tab === "past") {
        if (ev.status === "CANCELLED" || evTime >= todayStart) return false;
      } else if (tab === "cancelled") {
        if (ev.status !== "CANCELLED") return false;
      }

      if (hallFilter !== "ALL") {
        if (!ev.halls.some((h) => h.toLowerCase() === hallFilter.toLowerCase())) {
          return false;
        }
      }

      if (!q) return true;

      const dateStr = formatIST(ev.occasionDate, "dd MMM yyyy EEEE MMMM").toLowerCase();
      const misri = getMisriDate(ev.occasionDate);
      const misriStr = `${misri.formattedEn} ${misri.formattedAr}`.toLowerCase();

      return (
        ev.name.toLowerCase().includes(q) ||
        ev.mobile.toLowerCase().includes(q) ||
        (ev.email || "").toLowerCase().includes(q) ||
        ev.description.toLowerCase().includes(q) ||
        (ev.reference || "").toLowerCase().includes(q) ||
        ev.id.toLowerCase().includes(q) ||
        ev.halls.join(" ").toLowerCase().includes(q) ||
        ev.catererName.toLowerCase().includes(q) ||
        (ev.catererPhone || "").toLowerCase().includes(q) ||
        (ev.decoratorName || "").toLowerCase().includes(q) ||
        (ev.decoratorPhone || "").toLowerCase().includes(q) ||
        (ev.menu || "").toLowerCase().includes(q) ||
        dateStr.includes(q) ||
        misriStr.includes(q)
      );
    });

    const sorted = [...matches];
    sorted.sort((a, b) => {
      if (sortMode === "created_desc") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          new Date(b.occasionDate).getTime() - new Date(a.occasionDate).getTime()
        );
      }
      const diff =
        new Date(b.occasionDate).getTime() - new Date(a.occasionDate).getTime();
      if (sortMode === "date_asc") {
        return (
          -diff ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      return (
        diff ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    });

    return sorted;
  }, [events, tab, hallFilter, search, sortMode, todayStart]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedEvents = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage, pageSize]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hall Bookings & Functions"
        subtitle="All bookings sorted newest first — search by member, mobile, date, hall, caterer, or occasion"
        arabicBadge="حجز القاعات"
        actions={
          canCreate ? (
            <Link href="/events/new">
              <Button
                variant="primary"
                leftIcon={<CalendarPlus className="h-4 w-4" />}
              >
                New Hall Booking
              </Button>
            </Link>
          ) : undefined
        }
      />

      <AmountAccessBar unlocked={amountsUnlocked} />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          activeId={tab}
          onChange={(nextTab) => {
            setTab(nextTab);
            setPage(1);
          }}
          tabs={[
            { id: "all", label: "All Bookings", count: tabCounts.all },
            { id: "upcoming", label: "Upcoming & Today", count: tabCounts.upcoming },
            { id: "past", label: "Past Functions", count: tabCounts.past },
            { id: "cancelled", label: "Cancelled", count: tabCounts.cancelled },
          ]}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1 sm:w-80 sm:flex-none">
            <Input
              placeholder="Search name, mobile, date, hall, caterer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              leftAddon={<Search className="h-4 w-4" />}
              rightAddon={
                search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="rounded-md p-0.5 text-[#7B6B63] hover:bg-[#F3EFE6] hover:text-[#231917] cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : undefined
              }
            />
          </div>

          <select
            value={hallFilter}
            onChange={(e) => {
              setHallFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by Hall"
            className="h-10 rounded-xl border border-[#DCD2C2] bg-white px-3 text-xs font-semibold text-[#231917] shadow-2xs focus:border-[#6A1B1B] focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Halls &amp; Venues</option>
            {hallOptions.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          <div className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#DCD2C2] bg-white px-3 text-xs font-semibold text-[#231917] shadow-2xs">
            <ArrowDownWideNarrow className="h-3.5 w-3.5 text-[#6A1B1B]" />
            <select
              value={sortMode}
              onChange={(e) => {
                setSortMode(e.target.value as BookingSortMode);
                setPage(1);
              }}
              aria-label="Sort Bookings"
              className="bg-transparent text-xs font-semibold text-[#231917] focus:outline-none cursor-pointer"
            >
              <option value="date_desc">Date: Newest First</option>
              <option value="date_asc">Date: Oldest First</option>
              <option value="created_desc">Recently Recorded</option>
            </select>
          </div>
        </div>
      </div>

      {filteredAndSorted.length === 0 ? (
        <EmptyState
          title="No bookings match this view"
          description={
            search || hallFilter !== "ALL"
              ? "Try clearing your search or hall filter to see all bookings."
              : "Switch tabs or create a new hall booking."
          }
          action={
            search || hallFilter !== "ALL" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setHallFilter("ALL");
                  setPage(1);
                }}
              >
                Clear Search &amp; Filters
              </Button>
            ) : canCreate ? (
              <Link href="/events/new">
                <Button variant="primary">Create New Booking</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card accentTop className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#EAE2D6] bg-[#F3EFE6] text-xs font-semibold uppercase tracking-wider text-[#5E4F4A]">
                <tr>
                  <th className="px-4 py-3.5">Date &amp; Misri</th>
                  <th className="px-4 py-3.5">Occasion &amp; Booker</th>
                  <th className="px-4 py-3.5">Hall &amp; Thaals</th>
                  <th className="px-4 py-3.5">Caterer / Decorator</th>
                  <th className="px-4 py-3.5">Charges</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE2D6]">
                {paginatedEvents.map((ev) => {
                  const misri = getMisriDate(ev.occasionDate);
                  const isSelf = isSelfEventVenue(ev.halls);
                  return (
                    <tr
                      key={ev.id}
                      className="transition-colors hover:bg-[#FAF7F2]/80"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-[#231917]">
                          {formatIST(ev.occasionDate, "dd MMM yyyy")}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#6E5D55]">
                          <Clock className="h-3 w-3 text-[#6A1B1B]" />
                          {ev.occasionTime}
                        </div>
                        <div
                          dir="rtl"
                          className="font-arabic text-xs text-[#6A1B1B]"
                        >
                          {misri.formattedAr}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <Link
                          href={`/events/${encodeURIComponent(ev.id)}`}
                          className="font-bold text-[#6A1B1B] hover:underline"
                        >
                          {ev.description}
                        </Link>
                        <div className="text-xs text-[#4A3B36]">
                          {ev.name} • {ev.mobile}
                        </div>
                        {ev.reference ? (
                          <div className="mt-0.5 text-[11px] font-medium text-[#8C7B73]">
                            Ref: {ev.reference}
                          </div>
                        ) : null}
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <Badge
                            tone={
                              ev.status === "CANCELLED"
                                ? "crimson"
                                : ev.status === "COMPLETED"
                                  ? "sage"
                                  : "brass"
                            }
                          >
                            {ev.status === "COMPLETED"
                              ? "Completed"
                              : ev.status === "CANCELLED"
                                ? "Cancelled"
                                : "Booked"}
                          </Badge>
                          {ev.razaGranted ? (
                            <Badge tone="sage">Raza Confirmed</Badge>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 font-medium text-[#231917]">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#6A1B1B]" />
                          <span>{ev.halls.join(", ") || "Self"}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-[#6E5D55]">
                          {ev.thaalCount} Thaals
                          {ev.sarkariThaalSet > 0
                            ? ` • ${ev.sarkariThaalSet} Sarkari`
                            : ""}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-xs">
                        <div>
                          <span className="text-[#7B6B63]">Caterer: </span>
                          <strong className="text-[#231917]">
                            {ev.catererName || "Self"}
                          </strong>
                        </div>
                        {ev.decorations && !isSelf ? (
                          <div className="mt-1 flex items-center gap-1 text-[#6A1B1B]">
                            <Sparkles className="h-3 w-3 text-[#B8924A]" />
                            <span>
                              Decorator:{" "}
                              <strong>{ev.decoratorName || "Required"}</strong>
                            </span>
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {ev.amountsLocked ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#F3EFE6] px-2.5 py-1 text-xs text-[#7B6B63]">
                            <Lock className="h-3 w-3" /> Hidden
                          </span>
                        ) : (
                          <div>
                            <div className="font-bold text-[#231917]">
                              {formatRupees(ev.totalAmount || 0)}
                            </div>
                            {(ev.depositAmount || 0) > 0 ? (
                              <div className="text-[11px] text-[#925708]">
                                + {formatRupees(ev.depositAmount)} Deposit
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Link href={`/events/${encodeURIComponent(ev.id)}`}>
                            <Button size="xs" variant="secondary">
                              Open
                            </Button>
                          </Link>
                          {canManageVessels ? (
                            <Link
                              href={`/events/${encodeURIComponent(ev.id)}/inventory`}
                            >
                              <Button
                                size="xs"
                                variant="ghost"
                                title="Give Out / Return Store Items"
                              >
                                <Package className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          ) : null}
                          <Link
                            href={`/events/${encodeURIComponent(ev.id)}/print`}
                          >
                            <Button
                              size="xs"
                              variant="brass"
                              title="Print Form & Do's and Don'ts"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationBar
            currentPage={safePage}
            totalItems={filteredAndSorted.length}
            pageSize={pageSize}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
            itemLabel="bookings"
          />
        </Card>
      )}
    </div>
  );
}
