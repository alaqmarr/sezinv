"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatIST, getMisriDate } from "@sezsec/shared";

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

export function HijriDatePicker({
  label,
  value,
  onChange,
  required,
  error,
  disabled,
}: {
  label?: string;
  value: string; // yyyy-MM-dd
  onChange: (nextDate: string) => void;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const initialParts = useMemo(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [value]);

  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;
    const rect = trigger.getBoundingClientRect();
    const popoverWidth = Math.min(320, window.innerWidth - 16);
    const estimatedHeight = 350;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));

    if (openUpward) {
      setPopoverStyle({
        position: "fixed",
        left,
        width: popoverWidth,
        bottom: window.innerHeight - rect.top + 6,
        maxHeight: Math.max(260, spaceAbove),
      });
    } else {
      setPopoverStyle({
        position: "fixed",
        left,
        width: popoverWidth,
        top: rect.bottom + 6,
        maxHeight: Math.max(260, spaceBelow),
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!popoverRef.current || !popoverRef.current.contains(target))
      ) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onOutside);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  const selectedMisri = useMemo(
    () => (value ? getMisriDate(value) : null),
    [value]
  );

  const daysGrid = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ dateKey: string; day: number; hijriDayAr: string } | null> = [];

    for (let i = 0; i < firstWeekday; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const misri = getMisriDate(dateKey);
      cells.push({
        dateKey,
        day: d,
        hijriDayAr: misri.dayAr,
      });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const midMonthMisri = useMemo(() => {
    const midKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-15`;
    return getMisriDate(midKey);
  }, [viewYear, viewMonth]);

  const stepMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      {label ? (
        <label className="block text-xs font-semibold tracking-wide text-[#3D2E2A]">
          {label}
          {required ? <span className="ml-0.5 text-[#991B1B]">*</span> : null}
        </label>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!open) {
            setViewYear(initialParts.year);
            setViewMonth(initialParts.month);
          }
          setOpen((o) => !o);
        }}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3.5 text-left text-sm transition-colors focus:border-[#6A1B1B] focus:outline-none focus:ring-2 focus:ring-[#6A1B1B]/12 cursor-pointer",
          error ? "border-[#B91C1C]" : "border-[#DCD2C2]"
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5 truncate">
          <CalendarDays className="h-4 w-4 shrink-0 text-[#6A1B1B]" />
          {value ? (
            <span className="truncate font-medium text-[#231917]">
              {formatIST(value, "EEE, dd MMM yyyy")}
            </span>
          ) : (
            <span className="text-[#9E8E85]">Select date</span>
          )}
        </div>
        {selectedMisri ? (
          <span
            dir="rtl"
            className="font-arabic hidden shrink-0 sm:inline text-sm text-[#6A1B1B]"
          >
            {selectedMisri.formattedAr}
          </span>
        ) : null}
      </button>

      {selectedMisri ? (
        <div className="flex items-center justify-between px-1 text-xs text-[#6E5D55]">
          <span>{selectedMisri.formattedEn}</span>
          <span dir="rtl" className="font-arabic sm:hidden text-sm text-[#6A1B1B]">
            {selectedMisri.formattedAr}
          </span>
        </div>
      ) : null}

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              style={popoverStyle}
              className="no-print z-[130] overflow-y-auto rounded-2xl border border-[#D9C398] bg-white p-3.5 shadow-2xl"
            >
              <div className="mb-2.5 flex items-center justify-between border-b border-[#EAE2D6] pb-2.5">
                <button
                  type="button"
                  onClick={() => stepMonth(-1)}
                  className="rounded-lg p-1.5 text-[#5E4F4A] hover:bg-[#F3EFE6] cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-center">
                  <div className="text-sm font-semibold text-[#231917]">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </div>
                  <div dir="rtl" className="font-arabic text-xs text-[#6A1B1B]">
                    {midMonthMisri.monthNameAr} {midMonthMisri.yearAr}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => stepMonth(1)}
                  className="rounded-lg p-1.5 text-[#5E4F4A] hover:bg-[#F3EFE6] cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold text-[#8C7B73]">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {daysGrid.map((cell, i) => {
                  if (!cell) return <div key={`empty-${i}`} className="h-9.5" />;
                  const isSelected = cell.dateKey === value;
                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      onClick={() => {
                        onChange(cell.dateKey);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex h-9.5 flex-col items-center justify-center rounded-lg text-xs transition-colors cursor-pointer",
                        isSelected
                          ? "bg-[#6A1B1B] text-white font-semibold"
                          : "hover:bg-[#FBF6EB] text-[#231917]"
                      )}
                    >
                      <span className="leading-none">{cell.day}</span>
                      <span
                        className={cn(
                          "font-arabic mt-0.5 text-[11px] leading-none",
                          isSelected ? "text-[#F5DFB0]" : "text-[#8C7B73]"
                        )}
                      >
                        {cell.hijriDayAr}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}

      {error ? <p className="text-xs font-medium text-[#B91C1C]">{error}</p> : null}
    </div>
  );
}
