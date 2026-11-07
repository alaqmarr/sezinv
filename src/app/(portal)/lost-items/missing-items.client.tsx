"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Search, X, XCircle } from "lucide-react";
import { formatIST } from "@sezsec/shared";
import type { MissingItemRecord } from "@sezsec/inventory";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Modal,
  NumericStepper,
  PageHeader,
  PaginationBar,
  notify,
} from "@sezsec/ui";

export function MissingItemsClient({
  records,
  canResolve,
}: {
  records: MissingItemRecord[];
  canResolve: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modal, setModal] = useState<{
    record: MissingItemRecord;
    mode: "RECOVER" | "WRITE_OFF";
  } | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = records.filter((r) => {
      if (!q) return true;
      return (
        r.itemName.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.eventDescription.toLowerCase().includes(q) ||
        r.eventName.toLowerCase().includes(q)
      );
    });
    return list.sort(
      (a, b) =>
        new Date(b.occasionDate).getTime() - new Date(a.occasionDate).getTime()
    );
  }, [records, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRecords = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const handleResolve = async () => {
    if (!modal) return;
    setBusy(true);
    try {
      const res = await fetch("/api/inventory/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocationId: modal.record.allocationId,
          quantity: qty,
          mode: modal.mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not update", data.error || "Please try again.");
        return;
      }
      notify.success(
        modal.mode === "RECOVER" ? "Restored to store" : "Entry closed",
        `${qty} ${modal.record.unit} updated.`
      );
      setModal(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Missing Store Items"
        subtitle="Vessels or crockery marked missing during booking return checks (sorted newest first)"
        arabicBadge="المفقودات"
      />

      {records.length > 0 ? (
        <div className="max-w-md">
          <Input
            placeholder="Search item, booker, or occasion..."
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
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={
            records.length === 0
              ? "No missing items right now"
              : "No missing items match your search"
          }
          description={
            records.length === 0
              ? "All store vessels and crockery are accounted for."
              : "Try clearing your search to view all open missing entries."
          }
        />
      ) : (
        <Card accentTop className="overflow-hidden">
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F3EFE6] text-xs font-semibold uppercase text-[#5E4F4A]">
                <tr>
                  <th className="px-4 py-3.5">Item</th>
                  <th className="px-4 py-3.5">Booking &amp; Booker</th>
                  <th className="px-4 py-3.5">Function Date</th>
                  <th className="px-4 py-3.5 text-right">Still Missing</th>
                  {canResolve ? (
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE2D6]">
                {paginatedRecords.map((r) => (
                  <tr key={r.allocationId} className="hover:bg-[#FAF7F2]/80">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-[#231917]">{r.itemName}</div>
                      <div className="text-xs text-[#7B6B63]">{r.category}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/events/${encodeURIComponent(r.eventId)}`}
                        className="font-semibold text-[#6A1B1B] hover:underline"
                      >
                        {r.eventDescription}
                      </Link>
                      <div className="text-xs text-[#5E4F4A]">{r.eventName}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#5E4F4A]">
                      {formatIST(r.occasionDate, "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Badge tone="crimson">
                        {r.remainingMissing} {r.unit} missing
                      </Badge>
                    </td>
                    {canResolve ? (
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            size="xs"
                            variant="success"
                            leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                            onClick={() => {
                              setQty(r.remainingMissing);
                              setModal({ record: r, mode: "RECOVER" });
                            }}
                          >
                            Found — Add Back
                          </Button>
                          <Button
                            size="xs"
                            variant="secondary"
                            leftIcon={<XCircle className="h-3.5 w-3.5" />}
                            onClick={() => {
                              setQty(r.remainingMissing);
                              setModal({ record: r, mode: "WRITE_OFF" });
                            }}
                          >
                            Write Off
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
          <PaginationBar
            currentPage={safePage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(nextSize) => {
              setPageSize(nextSize);
              setPage(1);
            }}
            itemLabel="missing entries"
          />
        </Card>
      )}

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={
          modal?.mode === "RECOVER"
            ? `Item Found: ${modal.record.itemName}`
            : `Close Missing Entry: ${modal?.record.itemName}`
        }
        subtitle={
          modal?.mode === "RECOVER"
            ? "Adds the found quantity back into store stock."
            : "Marks this item as permanently settled so it no longer appears in Missing Items."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={handleResolve}>
              Confirm
            </Button>
          </>
        }
      >
        <NumericStepper
          label="Quantity"
          value={qty}
          min={1}
          max={modal?.record.remainingMissing || 1}
          onChange={setQty}
        />
      </Modal>
    </div>
  );
}
