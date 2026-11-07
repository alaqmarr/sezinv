"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, History, Search, X } from "lucide-react";
import { formatIST } from "@sezsec/shared";
import {
  ACTION_PLAIN_LABELS,
  type ActivityLogEntry,
} from "@sezsec/logs/logs.types";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  PaginationBar,
  Tabs,
  type BadgeTone,
} from "@sezsec/ui";

function getActivityTone(action: string): BadgeTone {
  if (
    action.startsWith("EVENT_CANCELLED") ||
    action.endsWith("DELETED") ||
    action.includes("LOST")
  ) {
    return "crimson";
  }
  if (action.startsWith("EVENT_")) return "maroon";
  if (action.startsWith("AMOUNT_")) return "brass";
  if (action.startsWith("INVENTORY_") || action.startsWith("STOCK_"))
    return "sage";
  return "neutral";
}

function matchesCategory(action: string, cat: string): boolean {
  if (cat === "all") return true;
  if (cat === "bookings") return action.startsWith("EVENT_");
  if (cat === "store")
    return action.startsWith("INVENTORY_") || action.startsWith("STOCK_");
  if (cat === "charges") return action.startsWith("AMOUNT_");
  if (cat === "office")
    return (
      action.startsWith("USER_") ||
      action === "MIGRATION_COMPLETED" ||
      action === "SYSTEM_RESET"
    );
  return true;
}

export function ActivityHistoryClient({
  entries,
}: {
  entries: ActivityLogEntry[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((item) => {
      if (!matchesCategory(item.action, category)) return false;
      if (!q) return true;
      const label = (
        ACTION_PLAIN_LABELS[item.action] || item.action
      ).toLowerCase();
      return (
        item.summary.toLowerCase().includes(q) ||
        item.userName.toLowerCase().includes(q) ||
        label.includes(q)
      );
    });
  }, [entries, query, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedEntries = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          activeId={category}
          onChange={(nextCategory) => {
            setCategory(nextCategory);
            setPage(1);
          }}
          tabs={[
            { id: "all", label: "All Activity", count: entries.length },
            { id: "bookings", label: "Hall Bookings" },
            { id: "store", label: "Store & Vessels" },
            { id: "charges", label: "Charges & Privacy" },
            { id: "office", label: "Team & Office" },
          ]}
        />
        <div className="w-full lg:w-80">
          <Input
            placeholder="Search person, booking, or action..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            leftAddon={<Search className="h-4 w-4" />}
            rightAddon={
              query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<History className="h-6 w-6" />}
          title="No activity records yet"
          description={
            entries.length === 0
              ? "Every booking update, store issue, and office change will be listed here in plain language."
              : "No activity matches your search or selected category."
          }
        />
      ) : (
        <Card accentTop className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EAE2D6] bg-[#FAF7F2] text-xs font-semibold uppercase tracking-wider text-[#7B6B63]">
                  <th className="px-5 py-3.5">When</th>
                  <th className="px-5 py-3.5">Activity</th>
                  <th className="px-5 py-3.5">Summary</th>
                  <th className="px-5 py-3.5">Done By</th>
                  <th className="px-5 py-3.5 text-right">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DD]">
                {paginatedEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="transition-colors hover:bg-[#FAF7F2]/70"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-[#6E5D55]">
                      <div className="font-medium text-[#231917]">
                        {formatIST(entry.timestamp, "dd MMM yyyy")}
                      </div>
                      <div>{formatIST(entry.timestamp, "hh:mm a")}</div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <Badge tone={getActivityTone(entry.action)}>
                        {ACTION_PLAIN_LABELS[entry.action] || entry.action}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-[#231917]">
                      {entry.summary}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium text-[#5E4F4A]">
                      {entry.userName}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      {entry.eventId ? (
                        <Link
                          href={`/events/${encodeURIComponent(entry.eventId)}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#DFD6C7] bg-white px-2.5 py-1 text-xs font-semibold text-[#6A1B1B] hover:border-[#B8924A] hover:bg-[#FBF6EB]"
                        >
                          View Booking
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-xs text-[#9E8E85]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            currentPage={safePage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
            itemLabel="activity entries"
          />
        </Card>
      )}
    </div>
  );
}
