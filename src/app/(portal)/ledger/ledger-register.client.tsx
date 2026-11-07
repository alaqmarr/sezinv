"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Search, X } from "lucide-react";
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

function getLedgerBadgeTone(action: string): BadgeTone {
  switch (action) {
    case "INVENTORY_ISSUED":
    case "INVENTORY_REMOVED":
      return "brass";
    case "INVENTORY_RETURNED":
    case "INVENTORY_RECOVERED":
      return "sage";
    case "INVENTORY_LOST":
    case "INVENTORY_LOSS":
    case "STOCK_DELETED":
      return "crimson";
    case "STOCK_ADDED":
    case "INVENTORY_ADDED":
      return "maroon";
    default:
      return "neutral";
  }
}

function matchesFilter(action: string, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "issued")
    return action === "INVENTORY_ISSUED" || action === "INVENTORY_REMOVED";
  if (filter === "returned") return action === "INVENTORY_RETURNED";
  if (filter === "missing")
    return action === "INVENTORY_LOST" || action === "INVENTORY_LOSS";
  if (filter === "found") return action === "INVENTORY_RECOVERED";
  if (filter === "stock")
    return (
      action === "STOCK_ADDED" ||
      action === "STOCK_UPDATED" ||
      action === "STOCK_DELETED" ||
      action === "INVENTORY_ADDED"
    );
  return true;
}

export function LedgerRegisterClient({
  entries,
}: {
  entries: ActivityLogEntry[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((item) => {
      if (!matchesFilter(item.action, filter)) return false;
      if (!q) return true;
      const plainLabel = (
        ACTION_PLAIN_LABELS[item.action] || item.action
      ).toLowerCase();
      return (
        item.summary.toLowerCase().includes(q) ||
        item.userName.toLowerCase().includes(q) ||
        plainLabel.includes(q)
      );
    });
  }, [entries, query, filter]);

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
          activeId={filter}
          onChange={(nextFilter) => {
            setFilter(nextFilter);
            setPage(1);
          }}
          tabs={[
            { id: "all", label: "All Entries", count: entries.length },
            { id: "issued", label: "Given Out" },
            { id: "returned", label: "Returned" },
            { id: "missing", label: "Marked Missing" },
            { id: "found", label: "Found" },
            { id: "stock", label: "Store Stock Updates" },
          ]}
        />
        <div className="w-full lg:w-80">
          <Input
            placeholder="Search item, booking, or staff..."
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
          icon={<BookOpen className="h-6 w-6" />}
          title="No stock movements found"
          description={
            entries.length === 0
              ? "Whenever vessels or crockery are given out, returned, or updated in the store, every entry appears here automatically."
              : "No entries match your search or selected filter."
          }
        />
      ) : (
        <Card accentTop className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EAE2D6] bg-[#FAF7F2] text-xs font-semibold uppercase tracking-wider text-[#7B6B63]">
                  <th className="px-5 py-3.5">Date &amp; Time</th>
                  <th className="px-5 py-3.5">Movement</th>
                  <th className="px-5 py-3.5">Details</th>
                  <th className="px-5 py-3.5">Recorded By</th>
                  <th className="px-5 py-3.5 text-right">Booking</th>
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
                      <Badge tone={getLedgerBadgeTone(entry.action)}>
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
                          Open Booking
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-xs text-[#9E8E85]">Store</span>
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
            itemLabel="register entries"
          />
        </Card>
      )}
    </div>
  );
}
