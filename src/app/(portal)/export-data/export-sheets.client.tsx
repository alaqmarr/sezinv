"use client";

import React, { useState } from "react";
import { CalendarDays, Download, FileSpreadsheet, Package, ScrollText } from "lucide-react";
import { cn } from "@sezsec/shared";
import { AmountAccessBar } from "@sezsec/finance";
import { usePermissions } from "@sezsec/rbac";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  HijriDatePicker,
  notify,
} from "@sezsec/ui";

type ExportDataset = "all" | "events" | "inventory" | "ledger";

const DATASET_OPTIONS: Array<{
  id: ExportDataset;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    id: "all",
    title: "Complete Office Workbook",
    description: "Includes Hall Bookings, Store Stock, and Activity History in 3 tabs.",
    icon: <FileSpreadsheet className="h-5 w-5" />,
  },
  {
    id: "events",
    title: "Hall Bookings Only",
    description: "All bookings with Misri/Gregorian dates, halls, caterers, and decorators.",
    icon: <CalendarDays className="h-5 w-5" />,
  },
  {
    id: "inventory",
    title: "Vessel & Crockery Stock",
    description: "Total stock, currently in store, and items currently out for functions.",
    icon: <Package className="h-5 w-5" />,
  },
  {
    id: "ledger",
    title: "Activity & Movement History",
    description: "Recent 1,000 office and store entries in chronological order.",
    icon: <ScrollText className="h-5 w-5" />,
  },
];

export function ExportSheetsClient() {
  const { amountUnlocked, canViewCharges } = usePermissions();
  const [dataset, setDataset] = useState<ExportDataset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [downloading, setDownloading] = useState(false);

  const supportsDateRange = dataset === "all" || dataset === "events";

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const params = new URLSearchParams({
        format: "xlsx",
        dataset,
      });
      if (supportsDateRange && fromDate) params.set("from", fromDate);
      if (supportsDateRange && toDate) params.set("to", toDate);

      const res = await fetch(`/api/settings/backup?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        notify.error("Could not prepare Excel sheet", err.error || "Please try again.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jamaat-${dataset}-records.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      notify.success(
        "Excel sheet downloaded",
        amountUnlocked && canViewCharges
          ? "Booking charges and deposits were included in the sheet."
          : canViewCharges
            ? "Downloaded without charge columns (amounts are hidden)."
            : "Booking, stock, and movement sheets saved to your device."
      );
    } catch {
      notify.error("Download failed", "Please check your connection and try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <AmountAccessBar unlocked={amountUnlocked} />

      <Card accentTop>
        <CardHeader
          title="Choose What to Download"
          subtitle="Creates a ready-to-open Microsoft Excel (.xlsx) spreadsheet."
          arabicRight="تصدير السجلات"
        />
        <CardBody className="space-y-6">
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {DATASET_OPTIONS.map((opt) => {
              const selected = dataset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDataset(opt.id)}
                  className={cn(
                    "flex items-start gap-3.5 rounded-2xl border p-4 text-left transition-all cursor-pointer",
                    selected
                      ? "border-[#6A1B1B] bg-[#FBF6EB]/70 shadow-xs"
                      : "border-[#E5DDD0] bg-white hover:border-[#D9C398]"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      selected
                        ? "bg-[#6A1B1B] text-white"
                        : "bg-[#F3EFE6] text-[#6A1B1B]"
                    )}
                  >
                    {opt.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#231917]">
                      {opt.title}
                    </div>
                    <p className="mt-0.5 text-xs text-[#6E5D55]">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {supportsDateRange ? (
            <div className="rounded-2xl border border-[#EAE2D6] bg-[#FAF7F2]/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-[#231917]">
                    Filter Bookings by Date Range (Optional)
                  </h4>
                  <p className="text-xs text-[#7B6B63]">
                    Leave blank to include all bookings from every date.
                  </p>
                </div>
                {fromDate || toDate ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                    }}
                  >
                    Clear Dates
                  </Button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <HijriDatePicker
                  label="From Date"
                  value={fromDate}
                  onChange={setFromDate}
                />
                <HijriDatePicker
                  label="Up To Date"
                  value={toDate}
                  onChange={setToDate}
                />
              </div>
            </div>
          ) : null}
        </CardBody>
        <CardFooter>
          <p className="text-xs text-[#6E5D55]">
            {amountUnlocked && canViewCharges
              ? "Rupee charges & refundable deposits will be included."
              : canViewCharges
                ? "Rupee charges are currently hidden and will be omitted from the sheet."
                : "Booking sheets include dates, halls, thaals, caterers, and decorators."}
          </p>
          <Button
            variant="primary"
            loading={downloading}
            leftIcon={<Download className="h-4 w-4" />}
            onClick={handleDownload}
          >
            Download Excel Sheet (.xlsx)
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
