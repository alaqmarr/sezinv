"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  FileDown,
  Lock,
  Search,
} from "lucide-react";
import { formatIST } from "@sezsec/shared";
import type { PortalEvent } from "@sezsec/events";
import type { EventInventoryAction, StoreItem } from "@sezsec/inventory";
import { downloadStoreManifestPdf } from "@sezsec/print";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Modal,
  NumericStepper,
  PageHeader,
  PaginationBar,
  notify,
} from "@sezsec/ui";

export function EventInventoryClient({
  event,
  storeItems,
  lockedForUser,
}: {
  event: PortalEvent;
  storeItems: StoreItem[];
  lockedForUser: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modalAction, setModalAction] = useState<{
    item: StoreItem;
    action: EventInventoryAction;
    maxQty: number;
  } | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  const allocMap = useMemo(() => {
    const map = new Map<
      string,
      {
        issuedQty: number;
        returnedQty: number;
        lostQty: number;
        recoveredQty: number;
      }
    >();
    for (const a of event.allocations || []) {
      map.set(a.itemId, a);
    }
    return map;
  }, [event.allocations]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return storeItems;
    return storeItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [storeItems, search]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);

  const submitMovement = async () => {
    if (!modalAction) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(event.id)}/inventory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            itemId: modalAction.item.id,
            action: modalAction.action,
            quantity: qty,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not update stock", data.error || "Please try again.");
        return;
      }
      notify.success("Store updated", "Item count updated for this booking.");
      setModalAction(null);
      router.refresh();
    } catch {
      notify.error("Network error", "Could not update store entry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Store Vessels: ${event.description}`}
        subtitle={`${event.name} • ${formatIST(event.occasionDate, "dd MMM yyyy")} • ${event.halls.join(", ") || "Self"}`}
        arabicBadge="أواني المخزن"
        backLink={
          <Link
            href={`/events/${encodeURIComponent(event.id)}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6A1B1B] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Booking Details
          </Link>
        }
        actions={
          <Button
            variant="brass"
            leftIcon={<FileDown className="h-4 w-4" />}
            onClick={() =>
              downloadStoreManifestPdf(event, event.allocations || [])
            }
          >
            Download Store Slip PDF
          </Button>
        }
      />

      {lockedForUser ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[#EED294] bg-[#FEF7E6] p-4 text-sm text-[#925708]">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            More than 48 hours have passed since this function started, so vessel
            entries are locked for regular staff. Please contact an Administrator
            if a change is needed.
          </span>
        </div>
      ) : null}

      <div className="max-w-md">
        <Input
          placeholder="Search vessel or crockery item..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          leftAddon={<Search className="h-4 w-4" />}
        />
      </div>

      <Card accentTop className="overflow-hidden">
        <CardHeader
          title="Give Out, Receive Back, or Mark Missing"
          subtitle="Store stock counts update immediately whenever items are given out or returned"
        />
        <CardBody className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F3EFE6] text-xs font-semibold uppercase text-[#5E4F4A]">
              <tr>
                <th className="px-4 py-3">Item Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">In Store Now</th>
                <th className="px-4 py-3 text-right">Given Out</th>
                <th className="px-4 py-3 text-right">Returned</th>
                <th className="px-4 py-3 text-right">Still Out</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE2D6]">
              {paginatedItems.map((item) => {
                const alloc = allocMap.get(item.id);
                const issued = alloc?.issuedQty || 0;
                const returned = alloc?.returnedQty || 0;
                const missing = Math.max(
                  0,
                  (alloc?.lostQty || 0) - (alloc?.recoveredQty || 0)
                );
                const outstanding = Math.max(0, issued - returned - missing);

                return (
                  <tr key={item.id} className="hover:bg-[#FAF7F2]/70">
                    <td className="px-4 py-3 font-semibold text-[#231917]">
                      {item.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{item.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {item.availableQuantity} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {issued} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-[#2A6041]">
                      {returned} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-[#6A1B1B]">
                      {outstanding} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          size="xs"
                          variant="primary"
                          disabled={lockedForUser || item.availableQuantity <= 0}
                          leftIcon={<ArrowUpRight className="h-3 w-3" />}
                          onClick={() => {
                            setQty(1);
                            setModalAction({
                              item,
                              action: "ISSUE",
                              maxQty: item.availableQuantity,
                            });
                          }}
                        >
                          Give Out
                        </Button>

                        {outstanding > 0 ? (
                          <>
                            <Button
                              size="xs"
                              variant="success"
                              disabled={lockedForUser}
                              leftIcon={<ArrowDownLeft className="h-3 w-3" />}
                              onClick={() => {
                                setQty(outstanding);
                                setModalAction({
                                  item,
                                  action: "RETURN",
                                  maxQty: outstanding,
                                });
                              }}
                            >
                              Return
                            </Button>
                            <Button
                              size="xs"
                              variant="danger"
                              disabled={lockedForUser}
                              leftIcon={<AlertTriangle className="h-3 w-3" />}
                              onClick={() => {
                                setQty(1);
                                setModalAction({
                                  item,
                                  action: "LOSS",
                                  maxQty: outstanding,
                                });
                              }}
                            >
                              Missing
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
        <PaginationBar
          currentPage={safePage}
          totalItems={filteredItems.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextSize) => {
            setPageSize(nextSize);
            setPage(1);
          }}
          itemLabel="store items"
        />
      </Card>

      <Modal
        open={Boolean(modalAction)}
        onClose={() => setModalAction(null)}
        title={
          modalAction?.action === "ISSUE"
            ? `Give Out: ${modalAction.item.name}`
            : modalAction?.action === "RETURN"
              ? `Receive Back: ${modalAction.item.name}`
              : `Mark Missing: ${modalAction?.item.name}`
        }
        subtitle={`Maximum allowed: ${modalAction?.maxQty || 0} ${modalAction?.item.unit || ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalAction(null)}>
              Cancel
            </Button>
            <Button
              variant={modalAction?.action === "LOSS" ? "danger" : "primary"}
              loading={busy}
              onClick={submitMovement}
            >
              Confirm Entry
            </Button>
          </>
        }
      >
        <NumericStepper
          label={`Quantity (${modalAction?.item.unit || "pcs"})`}
          value={qty}
          min={1}
          max={modalAction?.maxQty || 1}
          onChange={setQty}
        />
      </Modal>
    </div>
  );
}
