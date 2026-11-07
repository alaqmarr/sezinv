"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ClipboardCheck,
  Clock,
  FileDown,
  IndianRupee,
  Lock,
  Printer,
} from "lucide-react";
import {
  formatIST,
  formatRupees,
  formatTimeDisplay,
  getMisriDate,
  isSelfEventVenue,
} from "@sezsec/shared";
import type { PortalEvent } from "@sezsec/events";
import {
  AmountAccessBar,
  EventChargesDrawer,
} from "@sezsec/finance";
import {
  downloadBookingPdf,
  type BookingGuidelinesConfig,
} from "@sezsec/print";
import {
  Button,
  Input,
  Select,
  Switch,
  Tabs,
  notify,
} from "@sezsec/ui";

function RoyalFatimidPrintHeader({
  documentTitle,
  subtitle = "Hall Bookings, Store Vessels & Jamaat Arrangements",
  compact = false,
}: {
  documentTitle: string;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div
        className={`fatimid-sheet-pattern relative flex items-center justify-between gap-3 rounded-xl border border-[#D9C398] bg-[#FAF7F2] px-4 ${
          compact ? "py-2" : "py-2.5"
        }`}
      >
        {/* Left Crest */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#D9C398] bg-white p-1 shadow-2xs">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/crest.png"
            alt="Anjuman-e-Mohammedi Crest"
            className="h-full w-full object-contain"
          />
        </div>

        {/* Center Calligraphy & Jamaat Trust Branding */}
        <div className="min-w-0 flex-1 rounded-lg bg-[#FAF7F2]/92 px-3 py-0.5 text-center">
          <p
            dir="rtl"
            className={`font-arabic leading-snug text-[#6A1B1B] ${
              compact ? "text-base" : "text-lg"
            }`}
          >
            بسم الله الرحمن الرحيم
          </p>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#8A6421]">
            Dawoodi Bohra Jamaat Trust
          </p>
          <h2
            className={`font-extrabold tracking-tight text-[#231917] ${
              compact ? "text-sm" : "text-base"
            }`}
          >
            ANJUMAN-E-MOHAMMEDI, SECUNDERABAD
          </h2>
          <p className="text-[10px] text-[#6E5D55]">{subtitle}</p>
        </div>

        {/* Right Fatimid Geometric Rosette Medallion */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#D9C398] bg-[#FBF6EB]">
          <svg
            width="26"
            height="26"
            viewBox="0 0 96 96"
            fill="none"
            aria-hidden="true"
          >
            <g stroke="#B8924A" strokeWidth="3.2">
              <path d="M48 6 L57 27 L78 18 L69 39 L90 48 L69 57 L78 78 L57 69 L48 90 L39 69 L18 78 L27 57 L6 48 L27 39 L18 18 L39 27 Z" />
              <polygon points="48,22 56,40 74,48 56,56 48,74 40,56 22,48 40,40" />
              <circle cx="48" cy="48" r="6" />
            </g>
          </svg>
        </div>
      </div>

      {/* Royal Maroon Document Title Bar */}
      <div className="rounded-lg bg-[#6A1B1B] py-1 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#FAF7F2]">
        {documentTitle}
      </div>
    </div>
  );
}

function OfficialA4SheetFooter({
  refCode,
  generatedStamp,
  pageNumber,
  totalPages,
}: {
  refCode: string;
  generatedStamp: string;
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <div className="mt-auto border-t border-[#D9C398] pt-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold tracking-tight text-[#6A1B1B]">
            ANJUMAN-E-MOHAMMEDI
          </p>
          <p className="text-[9.5px] text-[#6E5D55]">
            Miqaat Documentation • Secunderabad Jamaat
          </p>
        </div>
        <div className="text-center text-[9.5px] font-semibold text-[#7B6B63]">
          Page {pageNumber} of {totalPages}
        </div>
        <div className="text-right">
          <p className="font-mono text-[10.5px] font-bold tracking-wider text-[#231917]">
            Ref: {refCode}
          </p>
          <p className="text-[9px] text-[#7B6B63]">
            Generated on {generatedStamp}
          </p>
        </div>
      </div>
    </div>
  );
}

export function EventPrintClient({
  event,
  guidelines,
  amountsUnlocked,
  printUnlockExpiresAt,
  canEditCharges,
}: {
  event: PortalEvent;
  guidelines: BookingGuidelinesConfig;
  amountsUnlocked: boolean;
  printUnlockExpiresAt: number | null;
  canEditCharges: boolean;
}) {
  const router = useRouter();
  const [printMode, setPrintMode] = useState<"BOOKING_FORM" | "CHECKLIST">(
    "BOOKING_FORM"
  );
  const [includeDosAndDonts, setIncludeDosAndDonts] = useState(true);
  const [chargesDrawerOpen, setChargesDrawerOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [lockingTimer, setLockingTimer] = useState(false);

  // Payment quick-save toolbar (matching jamat-inventory-master)
  const [paymentMode, setPaymentMode] = useState<string>(
    event.paymentMode || "CASH"
  );
  const [transactionId, setTransactionId] = useState<string>(
    event.transactionId || ""
  );
  const [savingPayment, setSavingPayment] = useState(false);
  const generatedStamp = formatIST(
    event.updatedAt || event.createdAt,
    "dd MMM yyyy, hh:mm a"
  );

  // Live 10-minute post-booking countdown
  const [secondsState, setSecondsState] = useState<number | null>(() =>
    printUnlockExpiresAt
      ? Math.max(0, Math.ceil((printUnlockExpiresAt - Date.now()) / 1000))
      : null
  );
  const secondsRemaining = printUnlockExpiresAt ? secondsState : null;

  const clearBookingTimerNow = useCallback(
    async (silent = false) => {
      setLockingTimer(true);
      try {
        await fetch("/api/finance/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "booking" }),
        });
        setSecondsState(null);
        if (!silent) {
          notify.info(
            "Print timer cleared",
            "Booking charges are now hidden again."
          );
        }
        router.refresh();
      } finally {
        setLockingTimer(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (!printUnlockExpiresAt) {
      return;
    }
    const tick = () => {
      const rem = Math.max(
        0,
        Math.ceil((printUnlockExpiresAt - Date.now()) / 1000)
      );
      setSecondsState(rem);
      if (rem <= 0) {
        void clearBookingTimerNow(true);
      }
    };
    const initialId = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initialId);
      window.clearInterval(id);
    };
  }, [printUnlockExpiresAt, clearBookingTimerNow]);

  const misri = getMisriDate(event.occasionDate);
  const isSelf = isSelfEventVenue(event.halls);
  const isChecklist = printMode === "CHECKLIST";
  const showAmountsOnSheet =
    !isChecklist && amountsUnlocked && !event.amountsLocked;
  const totalPages = includeDosAndDonts ? 2 : 1;
  const refCode =
    event.reference ||
    `${formatIST(event.occasionDate, "yyyyMMdd")}-${event.mobile}`;

  const generalChargeRows = useMemo(() => {
    if (!showAmountsOnSheet) return [];
    const rows: Array<{
      label: string;
      qty: string;
      rate: string;
      amount: number;
    }> = [];
    if ((event.thaalAmount || 0) > 0) {
      const cnt = event.thaalCount || 0;
      const rate =
        event.thaalRate || (cnt > 0 ? (event.thaalAmount || 0) / cnt : 0);
      rows.push({
        label: "Thaal Charges",
        qty: cnt > 0 ? String(cnt) : "1",
        rate: rate > 0 ? formatRupees(rate) : "—",
        amount: event.thaalAmount || 0,
      });
    }
    if ((event.sarkariAmount || 0) > 0) {
      const cnt = event.sarkariThaalSet || 0;
      const rate =
        event.sarkariRate || (cnt > 0 ? (event.sarkariAmount || 0) / cnt : 0);
      rows.push({
        label: "Sarkari Thaal Sets",
        qty: cnt > 0 ? String(cnt) : "1",
        rate: rate > 0 ? formatRupees(rate) : "—",
        amount: event.sarkariAmount || 0,
      });
    }
    if ((event.kitchenCharge || 0) > 0) {
      rows.push({
        label: "Kitchen / Gas Charge",
        qty: "1",
        rate: formatRupees(event.kitchenCharge),
        amount: event.kitchenCharge || 0,
      });
    }
    if ((event.decorationCharge || 0) > 0) {
      rows.push({
        label: "Decoration Charge",
        qty: "1",
        rate: formatRupees(event.decorationCharge),
        amount: event.decorationCharge || 0,
      });
    }
    if ((event.otherCharge || 0) > 0) {
      rows.push({
        label: "Other / Misc Charge",
        qty: "1",
        rate: formatRupees(event.otherCharge),
        amount: event.otherCharge || 0,
      });
    }
    return rows;
  }, [event, showAmountsOnSheet]);

  const hallChargeRows = useMemo(() => {
    if (!showAmountsOnSheet || !event.hallCharges) return [];
    return Object.entries(event.hallCharges)
      .filter(([, amt]) => amt > 0)
      .map(([hall, amount]) => ({ hall, amount }));
  }, [event.hallCharges, showAmountsOnSheet]);

  const checkedRequirements = useMemo(
    () =>
      [
        { label: "Bhai Saab Izzan", active: event.bhaiSaabIzzan },
        { label: "Muraqebeen Izzan", active: event.muraqebeenIzzan },
        { label: "Ben Saab Izzan", active: event.benSaabIzzan },
        { label: "Microphone", active: event.mic },
        { label: "Store Crockery", active: event.crockeryRequired },
        { label: "Thaal for Devri", active: event.thaalForDevri },
        { label: "PAAT", active: event.paat },
        { label: "Masjid Light", active: event.masjidLight },
      ].filter((r) => r.active),
    [event]
  );

  const handleSavePayment = async () => {
    if (paymentMode === "UPI" && !transactionId.trim()) {
      notify.warning(
        "Transaction reference needed",
        "Please enter the UPI / bank reference number."
      );
      return;
    }
    setSavingPayment(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMode,
          transactionId: paymentMode === "UPI" ? transactionId.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not save payment", data.error || "Please try again.");
        return;
      }
      notify.success("Payment details saved");
      router.refresh();
    } catch {
      notify.error("Network error", "Could not save payment details.");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfBusy(true);
    try {
      await downloadBookingPdf({
        event,
        guidelines,
        mode: printMode,
        includeDosAndDonts,
        showAmounts: showAmountsOnSheet,
      });
      notify.success("PDF downloaded", "A4 print-ready PDF saved to your device.");
    } catch {
      notify.error("Could not generate PDF", "Please try again.");
    } finally {
      setPdfBusy(false);
    }
  };

  const formattedCountdown =
    secondsRemaining !== null
      ? `${String(Math.floor(secondsRemaining / 60)).padStart(2, "0")}:${String(
          secondsRemaining % 60
        ).padStart(2, "0")}`
      : null;

  return (
    <div className="space-y-6 print:space-y-0">
      {/* ================================================================= */}
      {/* CONTROL TOOLBAR (HIDDEN WHEN PRINTING)                            */}
      {/* ================================================================= */}
      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/events/${encodeURIComponent(event.id)}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6A1B1B] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Booking Details
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            {amountsUnlocked && canEditCharges ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<IndianRupee className="h-4 w-4" />}
                onClick={() => setChargesDrawerOpen(true)}
              >
                Edit Charges
              </Button>
            ) : null}

            <Button
              variant="brass"
              size="sm"
              loading={pdfBusy}
              leftIcon={<FileDown className="h-4 w-4" />}
              onClick={handleDownloadPdf}
            >
              Download A4 PDF
            </Button>

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Printer className="h-4 w-4" />}
              onClick={() => window.print()}
            >
              Print A4 Now
            </Button>
          </div>
        </div>

        {/* 10-Minute Temporary Print Unlock Banner OR Standard AmountAccessBar */}
        {formattedCountdown !== null ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#B7DBC3] bg-[#F2FAF5] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2A6041]/12 text-[#2A6041]">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#1E4730]">
                    Booking Print Window — Charges Visible for Booker Copy
                  </p>
                  <span className="rounded-full border border-[#2A6041]/30 bg-white px-2.5 py-0.5 font-mono text-xs font-bold text-[#2A6041]">
                    {formattedCountdown} left
                  </span>
                </div>
                <p className="text-xs text-[#3C684E]">
                  Charges remain unlocked for 10 minutes on this newly created
                  booking so you can print or download the confirmation form with
                  amounts.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              loading={lockingTimer}
              leftIcon={<Lock className="h-3.5 w-3.5" />}
              onClick={() => clearBookingTimerNow(false)}
            >
              Done Printing — Clear Timer
            </Button>
          </div>
        ) : (
          <AmountAccessBar unlocked={amountsUnlocked} />
        )}

        {/* Quick Payment Mode & Document Mode Controls */}
        <div className="flex flex-col gap-4 rounded-2xl border border-[#E5DDD0] bg-white p-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              activeId={printMode}
              onChange={(id) =>
                setPrintMode(id as "BOOKING_FORM" | "CHECKLIST")
              }
              tabs={[
                { id: "BOOKING_FORM", label: "Booker Confirmation Form" },
                {
                  id: "CHECKLIST",
                  label: "Caretaker Verification Sheet",
                  icon: <ClipboardCheck className="h-3.5 w-3.5" />,
                },
              ]}
            />

            <div className="w-full sm:w-auto sm:min-w-[260px]">
              <Switch
                checked={includeDosAndDonts}
                onChange={setIncludeDosAndDonts}
                label="Include Do's & Don'ts Page"
                description="Page 2 guidelines sheet for booker"
              />
            </div>
          </div>

          {amountsUnlocked && canEditCharges ? (
            <div className="flex flex-wrap items-end gap-2.5 border-t border-[#EAE2D6] pt-3 xl:border-t-0 xl:pt-0">
              <div className="w-36">
                <Select
                  label="Payment Mode"
                  value={paymentMode}
                  onChange={setPaymentMode}
                  options={[
                    { value: "CASH", label: "Cash" },
                    { value: "UPI", label: "UPI / Online" },
                    { value: "CHEQUE", label: "Cheque" },
                  ]}
                />
              </div>
              {paymentMode !== "CASH" ? (
                <div className="w-48">
                  <Input
                    label="Transaction / Ref ID"
                    placeholder="Enter reference..."
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                  />
                </div>
              ) : null}
              <Button
                variant="secondary"
                size="md"
                loading={savingPayment}
                leftIcon={<Check className="h-4 w-4" />}
                onClick={handleSavePayment}
              >
                Save Payment
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ================================================================= */}
      {/* A4 PAGES CONTAINER (SCROLLABLE ON NARROW SCREENS, EXACT A4 PRINT) */}
      {/* ================================================================= */}
      <div className="overflow-x-auto pb-2 print:overflow-visible print:pb-0">
        <div className="mx-auto flex w-fit flex-col gap-6 print:mx-0 print:block print:w-full">
          {/* ============================================================= */}
          {/* A4 SHEET 1: MIQAAT BOOKING CONFIRMATION / CHECKLIST           */}
          {/* ============================================================= */}
          <section className="a4-print-sheet mx-auto flex w-[210mm] min-h-[297mm] flex-col gap-3 rounded-lg border border-[#E5DDD0] bg-white px-[6mm] py-[6mm] shadow-md print:rounded-none print:border-0 print:shadow-none">
                {/* 1. Royal Fatimid Arabic Geometric Pattern Header */}
                <RoyalFatimidPrintHeader
                  documentTitle={
                    isChecklist
                      ? "Hall & Store Verification Checklist"
                      : "Miqaat Booking Confirmation Form"
                  }
                />

                {/* 2. Reference & Misri Date Bar */}
                <div className="flex items-center justify-between gap-3 rounded-lg border border-[#D9C398] bg-[#FBF6EB] px-3.5 py-2 text-[11px]">
                  <div>
                    <p className="font-bold text-[#231917]">
                      Booking Ref: <span className="font-mono">{refCode}</span>
                    </p>
                    <p className="text-[#4A3B36]">
                      {formatIST(event.occasionDate, "EEEE, dd MMMM yyyy")} •{" "}
                      <strong>{formatTimeDisplay(event.occasionTime)}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      dir="rtl"
                      className="font-arabic text-base leading-tight text-[#6A1B1B]"
                    >
                      {misri.formattedAr}
                    </p>
                    <p className="text-[10.5px] font-semibold text-[#6A1B1B]">
                      Hijri: {misri.formattedEn}
                    </p>
                  </div>
                </div>

                {/* 3. Booker & Occasion 2-Column Section */}
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-[#E5DDD0] bg-white px-3.5 py-2.5 text-[11px]">
                  <div>
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#8C7B73]">
                      Booker Details
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-[#231917]">
                      {event.name}
                    </p>
                    <p className="font-mono text-[11px] text-[#4A3B36]">
                      {event.mobile}
                      {event.email ? (
                        <span className="font-sans"> • {event.email}</span>
                      ) : null}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#8C7B73]">
                      Occasion Details
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-[#231917]">
                      {event.description}
                    </p>
                    <p className="text-[11px] text-[#4A3B36]">
                      {event.eventType === "PUBLIC"
                        ? "Public Jamaat Miqaat"
                        : "Private Family Function"}{" "}
                      • Raza:{" "}
                      <strong>
                        {event.razaGranted ? "Granted" : "Pending"}
                      </strong>
                    </p>
                  </div>
                </div>

                {/* 4. Venue, Caterer & Decorator Box */}
                <div className="rounded-lg border border-[#DCD2C2] bg-[#FAF7F2] px-3.5 py-2.5 text-[11px]">
                  <div
                    className={`grid gap-4 ${
                      event.decorations && !isSelf
                        ? "grid-cols-3"
                        : "grid-cols-2"
                    }`}
                  >
                    <div>
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#6A1B1B]">
                        Hall(s) / Venue
                      </p>
                      <p className="mt-0.5 font-bold text-[#231917]">
                        {event.halls
                          .map((h) =>
                            event.hallCounts?.[h]
                              ? `${h} (${event.hallCounts[h]})`
                              : h
                          )
                          .join(", ") || "Self"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#6A1B1B]">
                        Caterer
                      </p>
                      <p className="mt-0.5 font-bold text-[#231917]">
                        {event.catererName || "Self"}
                        {event.catererPhone ? (
                          <span className="ml-1 font-normal text-[#5E4F4A]">
                            ({event.catererPhone})
                          </span>
                        ) : null}
                      </p>
                    </div>
                    {event.decorations && !isSelf ? (
                      <div>
                        <p className="text-[9.5px] font-bold uppercase tracking-wider text-[#6A1B1B]">
                          Decorator
                        </p>
                        <p className="mt-0.5 font-bold text-[#231917]">
                          {event.decoratorName || "To be confirmed"}
                          {event.decoratorPhone ? (
                            <span className="ml-1 font-normal text-[#5E4F4A]">
                              ({event.decoratorPhone})
                            </span>
                          ) : null}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* 5. Requirements & Menu (3-Col Grid matching jamat-inventory-master) */}
                <div className="grid grid-cols-3 gap-3.5 text-[11px]">
                  <div className="col-span-2 space-y-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#6A1B1B]">
                      Requirements &amp; Arrangements
                    </h4>
                    <div className="grid grid-cols-2 gap-x-5 gap-y-1 rounded-lg border border-[#E5DDD0] px-3 py-2">
                      <div className="flex items-center justify-between border-b border-dotted border-[#DCD2C2] py-1">
                        <span className="text-[#5E4F4A]">Thaal Count</span>
                        <span className="font-bold text-[#231917]">
                          {event.thaalCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-dotted border-[#DCD2C2] py-1">
                        <span className="text-[#5E4F4A]">Sarkari Sets</span>
                        <span className="font-bold text-[#231917]">
                          {event.sarkariThaalSet}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-dotted border-[#DCD2C2] py-1">
                        <span className="text-[#5E4F4A]">Tables &amp; Chairs</span>
                        <span className="font-bold text-[#231917]">
                          {event.tablesAndChairs}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-dotted border-[#DCD2C2] py-1">
                        <span className="text-[#5E4F4A]">Extra Chilamchi</span>
                        <span className="font-bold text-[#231917]">
                          {event.extraChilamchiLota}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-dotted border-[#DCD2C2] py-1">
                        <span className="text-[#5E4F4A]">AC Start Time</span>
                        <span className="font-bold text-[#231917]">
                          {event.acStartTime
                            ? formatTimeDisplay(event.acStartTime)
                            : "NA"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-dotted border-[#DCD2C2] py-1">
                        <span className="text-[#5E4F4A]">Party Time</span>
                        <span className="font-bold text-[#231917]">
                          {event.partyTime
                            ? formatTimeDisplay(event.partyTime)
                            : "NA"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#5E4F4A]">Gas Count</span>
                        <span className="font-bold text-[#231917]">
                          {event.gasCount || 0}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-[#5E4F4A]">Decorations</span>
                        <span className="font-bold text-[#231917]">
                          {event.decorations ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>

                    {checkedRequirements.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {checkedRequirements.map((item) => (
                          <span
                            key={item.label}
                            className="inline-flex items-center gap-1 rounded-md border border-[#B7DBC3] bg-[#E8F3EC] px-2 py-0.5 text-[10px] font-semibold text-[#2A6041]"
                          >
                            <Check className="h-2.5 w-2.5" />
                            {item.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="col-span-1 flex flex-col">
                    <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#6A1B1B]">
                      Food Menu
                    </h4>
                    <div className="flex-1 rounded-lg border border-[#DCD2C2] bg-[#FAF7F2] p-2.5 text-[10.5px] leading-snug whitespace-pre-wrap text-[#231917]">
                      {event.menu || "No menu specified."}
                    </div>
                  </div>
                </div>

                {/* 6. Lagat Details & Refundable Deposit OR Caretaker Checklist */}
                {isChecklist ? (
                  <div>
                    <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6A1B1B]">
                      Post-Function Caretaker Verification
                    </h4>
                    <table className="w-full border-collapse border border-[#DCD2C2] text-[10.5px]">
                      <thead className="bg-[#6A1B1B] text-[#FAF7F2]">
                        <tr>
                          <th className="px-2.5 py-1.5 text-left">
                            Inspection Point
                          </th>
                          <th className="px-2.5 py-1.5 text-center">Verified</th>
                          <th className="px-2.5 py-1.5 text-left">
                            Caretaker Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          "Hall floor, carpets & wash basins left clean",
                          "AC units, fans, lights & sound switched off",
                          "Decorations cleared without wall/pillar damage",
                          "Store Thaals & vessels returned washed & counted",
                          "Actual Thaals served count recorded",
                        ].map((item) => (
                          <tr key={item}>
                            <td className="border border-[#DCD2C2] px-2.5 py-1.5 font-medium">
                              {item}
                            </td>
                            <td className="border border-[#DCD2C2] px-2.5 py-1.5 text-center">
                              ☐ Yes &nbsp;&nbsp; ☐ No
                            </td>
                            <td className="border border-[#DCD2C2] px-2.5 py-1.5" />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div>
                    <h4 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6A1B1B]">
                      Lagat / Booking Charges Details
                    </h4>
                    <div className="flex items-stretch gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {showAmountsOnSheet &&
                        (generalChargeRows.length > 0 ||
                          hallChargeRows.length > 0) ? (
                          <div
                            className={`grid gap-2.5 ${
                              generalChargeRows.length > 0 &&
                              hallChargeRows.length > 0
                                ? "grid-cols-12"
                                : "grid-cols-1"
                            }`}
                          >
                            {generalChargeRows.length > 0 ? (
                              <div
                                className={
                                  hallChargeRows.length > 0
                                    ? "col-span-7"
                                    : "col-span-1"
                                }
                              >
                                <table className="w-full border-collapse border border-[#DCD2C2] text-[10.5px]">
                                  <thead className="bg-[#6A1B1B] text-[#FAF7F2]">
                                    <tr>
                                      <th className="border border-[#6A1B1B] px-2 py-1 text-left">
                                        General Item
                                      </th>
                                      <th className="border border-[#6A1B1B] px-1.5 py-1 text-center">
                                        Qty
                                      </th>
                                      <th className="border border-[#6A1B1B] px-2 py-1 text-right">
                                        Rate
                                      </th>
                                      <th className="border border-[#6A1B1B] px-2 py-1 text-right">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {generalChargeRows.map((row) => (
                                      <tr key={row.label}>
                                        <td className="border border-[#DCD2C2] px-2 py-1 font-semibold">
                                          {row.label}
                                        </td>
                                        <td className="border border-[#DCD2C2] px-1.5 py-1 text-center">
                                          {row.qty}
                                        </td>
                                        <td className="border border-[#DCD2C2] px-2 py-1 text-right">
                                          {row.rate}
                                        </td>
                                        <td className="border border-[#DCD2C2] px-2 py-1 text-right font-bold">
                                          {formatRupees(row.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}

                            {hallChargeRows.length > 0 ? (
                              <div
                                className={
                                  generalChargeRows.length > 0
                                    ? "col-span-5"
                                    : "col-span-1"
                                }
                              >
                                <table className="w-full border-collapse border border-[#DCD2C2] text-[10.5px]">
                                  <thead className="bg-[#6A1B1B] text-[#FAF7F2]">
                                    <tr>
                                      <th className="border border-[#6A1B1B] px-2 py-1 text-left">
                                        Hall Charges
                                      </th>
                                      <th className="border border-[#6A1B1B] px-2 py-1 text-right">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {hallChargeRows.map((row) => (
                                      <tr key={row.hall}>
                                        <td className="border border-[#DCD2C2] px-2 py-1 font-semibold">
                                          {row.hall}
                                        </td>
                                        <td className="border border-[#DCD2C2] px-2 py-1 text-right font-bold">
                                          {formatRupees(row.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <table className="w-full border-collapse border border-[#DCD2C2] text-[10.5px]">
                            <thead className="bg-[#F6F2EA] text-[#231917]">
                              <tr>
                                <th className="border border-[#DCD2C2] px-2.5 py-1 text-left">
                                  Particulars
                                </th>
                                <th className="border border-[#DCD2C2] px-2 py-1 text-center">
                                  Qty
                                </th>
                                <th className="border border-[#DCD2C2] px-2.5 py-1 text-right">
                                  Amount
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td className="border border-[#DCD2C2] px-2.5 py-1 font-medium">
                                  Thaal &amp; Sarkari Sets
                                </td>
                                <td className="border border-[#DCD2C2] px-2 py-1 text-center">
                                  {event.thaalCount} / {event.sarkariThaalSet}
                                </td>
                                <td className="border border-[#DCD2C2] px-2.5 py-1 text-right text-[#7B6B63]">
                                  {showAmountsOnSheet ? formatRupees(0) : "—"}
                                </td>
                              </tr>
                              <tr>
                                <td className="border border-[#DCD2C2] px-2.5 py-1 font-medium">
                                  Hall, Kitchen &amp; Other Charges
                                </td>
                                <td className="border border-[#DCD2C2] px-2 py-1 text-center">
                                  —
                                </td>
                                <td className="border border-[#DCD2C2] px-2.5 py-1 text-right text-[#7B6B63]">
                                  —
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        )}

                        {/* Grand Total Bar */}
                        <div className="flex items-center justify-between rounded-md border border-[#B8924A] bg-[#FBF6EB] px-3 py-1.5 text-[11px] font-bold">
                          <span className="text-[#231917]">
                            GRAND TOTAL (Excl. Deposit)
                          </span>
                          <span className="text-xs text-[#6A1B1B]">
                            {showAmountsOnSheet
                              ? formatRupees(event.totalAmount || 0)
                              : "—"}
                          </span>
                        </div>

                        {showAmountsOnSheet &&
                        (event.paymentMode || event.amountNotes) ? (
                          <p className="text-[10px] text-[#5E4F4A]">
                            {event.paymentMode ? (
                              <span>
                                <strong>Payment Mode:</strong>{" "}
                                {event.paymentMode}
                                {event.transactionId
                                  ? ` (Tx Ref: ${event.transactionId})`
                                  : ""}
                              </span>
                            ) : null}
                            {event.paymentMode && event.amountNotes
                              ? "  •  "
                              : ""}
                            {event.amountNotes ? (
                              <span>
                                <strong>Notes:</strong> {event.amountNotes}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>

                      {/* Framed Refundable Deposit Box (Right) */}
                      <div className="flex w-32 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-[#6A1B1B] bg-[#FAF7F2] p-2.5 text-center">
                        <p className="text-[9.5px] font-bold uppercase leading-tight tracking-wider text-[#6A1B1B]">
                          Refundable
                          <br />
                          Deposit
                        </p>
                        <div className="my-1.5 h-px w-full bg-[#D9C398]" />
                        <p className="text-sm font-extrabold text-[#231917]">
                          {showAmountsOnSheet && (event.depositAmount || 0) > 0
                            ? formatRupees(event.depositAmount)
                            : "—"}
                        </p>
                        {showAmountsOnSheet && (event.depositAmount || 0) > 0 ? (
                          <p className="mt-0.5 text-[9px] text-[#6E5D55]">
                            {event.depositStatus === "REFUNDED"
                              ? "Returned"
                              : "Subject to clearance"}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. Bottom Signatures & Official Footer (Pinned cleanly inside A4 Page 1) */}
                <div className="mt-auto space-y-3 pt-4">
                  <div className="grid grid-cols-2 gap-14 pt-5 text-center text-[10.5px] font-bold uppercase tracking-wider text-[#3D2E2A]">
                    <div className="border-t border-[#9E8E85] pt-1.5">
                      Booker Signature
                    </div>
                    <div className="border-t border-[#9E8E85] pt-1.5">
                      Office Signature
                    </div>
                  </div>

                  <OfficialA4SheetFooter
                    refCode={refCode}
                    generatedStamp={generatedStamp}
                    pageNumber={1}
                    totalPages={totalPages}
                  />
                </div>
          </section>

          {/* ============================================================= */}
          {/* A4 SHEET 2: DO'S & DON'TS GUIDELINES (STRICT SINGLE A4 SHEET) */}
          {/* ============================================================= */}
          {includeDosAndDonts ? (
            <section className="a4-print-sheet print-page-break mx-auto flex w-[210mm] min-h-[297mm] flex-col gap-3 rounded-lg border border-[#E5DDD0] bg-white px-[6mm] py-[6mm] shadow-md print:rounded-none print:border-0 print:shadow-none">
                  <RoyalFatimidPrintHeader
                    documentTitle="Do's & Don'ts for Hall Bookers"
                    subtitle="Important Guidelines — Please Share with Your Family, Caterer & Decorator"
                    compact
                  />

                  {/* DO'S */}
                  <div className="overflow-hidden rounded-lg border border-[#B7DBC3]">
                    <div className="bg-[#2A6041] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Please Do (Important Responsibilities)
                    </div>
                    <ol className="divide-y divide-[#E2F0E7] bg-[#F8FCF9] text-[10.5px] leading-snug text-[#231917]">
                      {guidelines.dos.map((line, i) => (
                        <li key={i} className="flex gap-2.5 px-3.5 py-1.5">
                          <span className="shrink-0 font-bold text-[#2A6041]">
                            {i + 1}.
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* DONT'S */}
                  <div className="overflow-hidden rounded-lg border border-[#EEC2C2]">
                    <div className="bg-[#991B1B] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
                      Please Avoid (Strictly Not Permitted)
                    </div>
                    <ol className="divide-y divide-[#F6E2E2] bg-[#FFFDFD] text-[10.5px] leading-snug text-[#231917]">
                      {guidelines.donts.map((line, i) => (
                        <li key={i} className="flex gap-2.5 px-3.5 py-1.5">
                          <span className="shrink-0 font-bold text-[#991B1B]">
                            {i + 1}.
                          </span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {guidelines.footerNote ? (
                    <div className="rounded-lg border border-[#D9C398] bg-[#FBF6EB] px-3.5 py-2 text-[10.5px] leading-snug italic text-[#5C3D10]">
                      {guidelines.footerNote}
                    </div>
                  ) : null}

                  {/* Acknowledgment + Signature + Page 2 Footer */}
                  <div className="mt-auto space-y-3 pt-2">
                    <p className="text-[10.5px] text-[#3D2E2A]">
                      I have read and agreed to follow the above hall &amp;
                      store guidelines for Booking Ref:{" "}
                      <strong className="font-mono">{refCode}</strong>.
                    </p>
                    <div className="grid grid-cols-2 gap-14 pt-4 text-center text-[10.5px] font-bold uppercase tracking-wider text-[#3D2E2A]">
                      <div className="border-t border-[#9E8E85] pt-1.5">
                        Booker Name &amp; Signature
                      </div>
                      <div className="border-t border-[#9E8E85] pt-1.5">
                        Date
                      </div>
                    </div>

                    <OfficialA4SheetFooter
                      refCode={refCode}
                      generatedStamp={generatedStamp}
                      pageNumber={2}
                      totalPages={2}
                    />
                  </div>
            </section>
          ) : null}
        </div>
      </div>

      {amountsUnlocked ? (
        <EventChargesDrawer
          open={chargesDrawerOpen}
          onClose={() => setChargesDrawerOpen(false)}
          data={{
            eventId: event.id,
            thaalCount: event.thaalCount,
            sarkariThaalSet: event.sarkariThaalSet,
            halls: event.halls,
            initial: {
              thaalRate: event.thaalRate || 0,
              thaalAmount: event.thaalAmount || 0,
              sarkariRate: event.sarkariRate || 0,
              sarkariAmount: event.sarkariAmount || 0,
              kitchenCharge: event.kitchenCharge || 0,
              decorationCharge: event.decorationCharge || 0,
              otherCharge: event.otherCharge || 0,
              hallCharges: event.hallCharges || {},
              depositAmount: event.depositAmount || 0,
              depositStatus: event.depositStatus,
              paymentMode: event.paymentMode,
              transactionId: event.transactionId,
              amountNotes: event.amountNotes,
            },
          }}
        />
      ) : null}
    </div>
  );
}
