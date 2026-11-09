"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
} from "lucide-react";
import {
  cn,
  formatIST,
  getISTTodayString,
  getMisriDate,
  parseTimeToMinutes,
} from "@sezsec/shared";
import type { PortalEvent } from "@sezsec/events";
import { Badge, Button, Card, CardBody, CardHeader } from "@sezsec/ui";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function MisriScheduleCalendar({
  events,
  canCreateEvent = false,
}: {
  events: PortalEvent[];
  canCreateEvent?: boolean;
}) {
  const todayKey = useMemo(() => getISTTodayString(), []);
  const [initYear, initMonth] = useMemo(() => {
    const [y, m] = todayKey.split("-").map(Number);
    return [y, m - 1];
  }, [todayKey]);

  const [viewYear, setViewYear] = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, PortalEvent[]>();
    for (const ev of events) {
      if (ev.status === "CANCELLED") continue;
      const key = formatIST(ev.occasionDate, "yyyy-MM-dd");
      const list = map.get(key) || [];
      list.push(ev);
      map.set(key, list);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) =>
          parseTimeToMinutes(a.occasionTime) - parseTimeToMinutes(b.occasionTime)
      );
    }
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const firstDay = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const out: Array<{
      dateKey: string;
      day: number;
      hijriAr: string;
      hijriEn: string;
      dayEvents: PortalEvent[];
    } | null> = [];

    for (let i = 0; i < firstDay; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const misri = getMisriDate(dateKey);
      out.push({
        dateKey,
        day: d,
        hijriAr: misri.dayAr,
        hijriEn: `${misri.day} ${misri.monthNameEn.split("-")[0]}`,
        dayEvents: eventsByDate.get(dateKey) || [],
      });
    }
    return out;
  }, [viewYear, viewMonth, eventsByDate]);

  const headerMisri = useMemo(() => {
    const midKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-15`;
    return getMisriDate(midKey);
  }, [viewYear, viewMonth]);

  const selectedMisri = useMemo(
    () => getMisriDate(selectedDate),
    [selectedDate]
  );

  const selectedEvents = eventsByDate.get(selectedDate) || [];

  const stepMonth = (delta: number) => {
    const totalMonths = viewYear * 12 + viewMonth + delta;
    setViewYear(Math.floor(totalMonths / 12));
    setViewMonth(((totalMonths % 12) + 12) % 12);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <Card className="xl:col-span-8" accentTop>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE2D6] px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-[#231917]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </h3>
            <p className="text-xs text-[#7B6B63]">
              {headerMisri.monthNameEn} {headerMisri.year}H
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span dir="rtl" className="font-arabic text-xl text-[#6A1B1B]">
              {headerMisri.monthNameAr} {headerMisri.yearAr} هـ
            </span>
            <div className="flex items-center gap-1 rounded-xl border border-[#DCD2C2] bg-[#FAF7F2] p-1">
              <button
                type="button"
                onClick={() => stepMonth(-1)}
                className="rounded-lg p-1.5 text-[#5E4F4A] hover:bg-white cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewYear(initYear);
                  setViewMonth(initMonth);
                  setSelectedDate(todayKey);
                }}
                className="px-2.5 py-1 text-xs font-semibold text-[#6A1B1B] hover:bg-white rounded-lg cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => stepMonth(1)}
                className="rounded-lg p-1.5 text-[#5E4F4A] hover:bg-white cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <CardBody className="p-3 sm:p-5">
          <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-[#7B6B63]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`blank-${idx}`}
                    className="min-h-[78px] rounded-xl bg-[#FAF7F2]/40"
                  />
                );
              }
              const isToday = cell.dateKey === todayKey;
              const isSelected = cell.dateKey === selectedDate;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateKey)}
                  className={cn(
                    "flex min-h-[78px] sm:min-h-[90px] flex-col justify-start gap-1.5 rounded-xl border p-2 text-left transition-all cursor-pointer",
                    isSelected
                      ? "border-[#6A1B1B] bg-[#FBF6EB] ring-1 ring-[#6A1B1B]"
                      : isToday
                        ? "border-[#B8924A] bg-white"
                        : "border-[#EAE2D6] bg-white hover:border-[#D9C398] hover:bg-[#FAF7F2]"
                  )}
                >
                  <div className="flex w-full items-start justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                        isToday
                          ? "bg-[#6A1B1B] text-white"
                          : "text-[#231917]"
                      )}
                    >
                      {cell.day}
                    </span>
                    <span
                      dir="rtl"
                      className="font-arabic text-sm leading-none text-[#6A1B1B]"
                    >
                      {cell.hijriAr}
                    </span>
                  </div>

                  <div className="mt-1 space-y-1 w-full">
                    {cell.dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        className="truncate rounded-md bg-[#6A1B1B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#6A1B1B]"
                      >
                        {ev.description}
                      </div>
                    ))}
                    {cell.dayEvents.length > 2 ? (
                      <div className="text-[10px] font-semibold text-[#8C7B73]">
                        +{cell.dayEvents.length - 2} more
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card className="xl:col-span-4" accentTop>
        <CardHeader
          title={formatIST(selectedDate, "EEEE, dd MMM yyyy")}
          subtitle={selectedMisri.formattedEn}
          arabicRight={selectedMisri.formattedAr}
          action={
            canCreateEvent ? (
              <Link href={`/events/new?date=${selectedDate}`}>
                <Button
                  variant="secondary"
                  size="xs"
                  leftIcon={<CalendarPlus className="h-3.5 w-3.5 text-[#6A1B1B]" />}
                >
                  Book {formatIST(selectedDate, "dd MMM")}
                </Button>
              </Link>
            ) : undefined
          }
        />
        <CardBody className="space-y-3.5">
          {selectedEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#DCD2C2] bg-[#FAF7F2]/70 p-6 text-center text-sm text-[#7B6B63]">
              No bookings scheduled on this date. All halls are free.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedEvents.map((ev) => (
                <Link
                  key={ev.id}
                  href={`/events/${encodeURIComponent(ev.id)}`}
                  className="block rounded-xl border border-[#EAE2D6] bg-[#FAF7F2]/60 p-3.5 transition-colors hover:border-[#B8924A] hover:bg-[#FBF6EB]/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-sm text-[#231917]">
                        {ev.description}
                      </h4>
                      <p className="text-xs text-[#6E5D55]">{ev.name}</p>
                    </div>
                    <Badge
                      tone={ev.status === "COMPLETED" ? "sage" : "maroon"}
                    >
                      {ev.status === "COMPLETED" ? "Done" : "Booked"}
                    </Badge>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-3 text-xs text-[#5E4F4A]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[#6A1B1B]" />
                      {ev.occasionTime}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[#6A1B1B]" />
                      {ev.halls.join(", ") || "Self"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-[#6A1B1B]" />
                      {ev.thaalCount} Thaals
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
