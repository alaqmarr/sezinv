"use client";

import React, { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Copy,
  Edit3,
  IndianRupee,
  Lock,
  MapPin,
  Package,
  Phone,
  Printer,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  formatIST,
  formatRupees,
  getMisriDate,
  isSelfEventVenue,
} from "@sezsec/shared";
import type { PortalEvent } from "@sezsec/events";
import type { ActivityLogEntry } from "@sezsec/logs";
import {
  AmountAccessBar,
  EventChargesDrawer,
} from "@sezsec/finance";
import { usePermissions } from "@sezsec/rbac";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  ConfirmDialog,
  PageHeader,
  notify,
} from "@sezsec/ui";

function formatStatusLabel(status: PortalEvent["status"]): string {
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return "Booked";
}

export function EventDetailClient({
  event,
  logs,
  amountsUnlocked,
  canEdit,
  canEditCharges,
  canDelete,
  canManageVessels,
}: {
  event: PortalEvent;
  logs: ActivityLogEntry[];
  amountsUnlocked: boolean;
  canEdit: boolean;
  canEditCharges: boolean;
  canDelete: boolean;
  canManageVessels: boolean;
}) {
  const router = useRouter();
  const { canViewCharges } = usePermissions();
  const [chargesDrawerOpen, setChargesDrawerOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [forceDeletePrompt, setForceDeletePrompt] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  );

  const misri = getMisriDate(event.occasionDate);
  const isSelf = isSelfEventVenue(event.halls);

  const handleStatusChange = async (
    nextStatus: "BOOKED" | "COMPLETED" | "CANCELLED"
  ) => {
    setStatusBusy(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not update status", data.error || "Please try again.");
        return;
      }
      notify.success(
        "Status updated",
        `Marked as ${formatStatusLabel(nextStatus).toLowerCase()}.`
      );
      router.refresh();
    } finally {
      setStatusBusy(false);
    }
  };

  const handleDelete = async (force = false) => {
    setDeleteBusy(true);
    try {
      const res = await fetch(
        `/api/events/${encodeURIComponent(event.id)}${force ? "?force=true" : ""}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.status === 409 && data?.requiresForce && !force) {
        setConfirmDeleteOpen(false);
        setForceDeletePrompt(
          data.error ||
            "This booking still has store items recorded as out. Delete anyway and restore stock counts?"
        );
        return;
      }
      if (!res.ok) {
        notify.error("Could not delete", data.error || "Please try again.");
        return;
      }
      notify.success("Booking removed", "The booking has been deleted.");
      router.push("/events");
      router.refresh();
    } finally {
      setDeleteBusy(false);
      if (force) setForceDeletePrompt(null);
    }
  };

  const publicPassPath = `/public/events/${encodeURIComponent(event.id)}`;
  const fullPassUrl = origin ? `${origin}${publicPassPath}` : publicPassPath;

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.description}
        subtitle={`Booking Ref: ${event.reference || event.id} • Recorded by ${event.createdByName || "Office"}`}
        arabicBadge={misri.formattedAr}
        backLink={
          <Link
            href="/events"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6A1B1B] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Hall Bookings
          </Link>
        }
        actions={
          <>
            <Link href={`/events/${encodeURIComponent(event.id)}/print`}>
              <Button
                variant="brass"
                leftIcon={<Printer className="h-4 w-4" />}
              >
                Print Form &amp; Do&apos;s / Don&apos;ts
              </Button>
            </Link>
            {canManageVessels ? (
              <Link href={`/events/${encodeURIComponent(event.id)}/inventory`}>
                <Button
                  variant="secondary"
                  leftIcon={<Package className="h-4 w-4" />}
                >
                  Store Vessels
                </Button>
              </Link>
            ) : null}
            {canEdit ? (
              <Link href={`/events/${encodeURIComponent(event.id)}/edit`}>
                <Button
                  variant="primary"
                  leftIcon={<Edit3 className="h-4 w-4" />}
                >
                  Edit Booking
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <AmountAccessBar unlocked={amountsUnlocked} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {/* Core Booking Info */}
          <Card accentTop>
            <CardHeader
              title="Booker & Venue Summary"
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      event.status === "CANCELLED"
                        ? "crimson"
                        : event.status === "COMPLETED"
                          ? "sage"
                          : "maroon"
                    }
                  >
                    {formatStatusLabel(event.status)}
                  </Badge>
                  {event.razaGranted ? (
                    <Badge tone="sage">Raza Confirmed</Badge>
                  ) : (
                    <Badge tone="amber">Raza Pending</Badge>
                  )}
                </div>
              }
            />
            <CardBody className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-[#FAF7F2] p-4">
                  <p className="text-xs text-[#7B6B63]">Booker Details</p>
                  <p className="mt-1 text-base font-bold text-[#231917]">
                    {event.name}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#5E4F4A]">
                    <Phone className="h-3.5 w-3.5 text-[#6A1B1B]" />
                    {event.mobile}
                  </p>
                  {event.email ? (
                    <p className="mt-0.5 text-xs text-[#7B6B63]">{event.email}</p>
                  ) : null}
                </div>

                <div className="rounded-xl bg-[#FAF7F2] p-4">
                  <p className="text-xs text-[#7B6B63]">Date &amp; Timing</p>
                  <p className="mt-1 text-base font-bold text-[#231917]">
                    {formatIST(event.occasionDate, "EEEE, dd MMMM yyyy")}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#6A1B1B]">
                    <Clock className="h-3.5 w-3.5" />
                    {event.occasionTime}
                  </p>
                  <p className="mt-0.5 text-xs text-[#6E5D55]">
                    {misri.formattedEn}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[#EAE2D6] p-3.5">
                  <p className="text-xs text-[#7B6B63]">Hall / Venue</p>
                  <p className="mt-1 flex items-center gap-1.5 font-semibold text-[#231917]">
                    <MapPin className="h-4 w-4 shrink-0 text-[#6A1B1B]" />
                    <span>{event.halls.join(", ") || "Self"}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-[#EAE2D6] p-3.5">
                  <p className="text-xs text-[#7B6B63]">Caterer</p>
                  <p className="mt-1 font-semibold text-[#231917]">
                    {event.catererName || "Self"}
                  </p>
                  {event.catererPhone ? (
                    <p className="text-xs text-[#7B6B63]">{event.catererPhone}</p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-[#EAE2D6] p-3.5">
                  <p className="text-xs text-[#7B6B63]">Decorations</p>
                  {event.decorations ? (
                    !isSelf ? (
                      <div>
                        <p className="mt-1 flex items-center gap-1 font-semibold text-[#6A1B1B]">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#B8924A]" />
                          <span>{event.decoratorName || "Selected"}</span>
                        </p>
                        {event.decoratorPhone ? (
                          <p className="text-xs text-[#7B6B63]">
                            {event.decoratorPhone}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-1 font-semibold text-[#231917]">
                        Yes (Self Venue)
                      </p>
                    )
                  ) : (
                    <p className="mt-1 text-sm text-[#7B6B63]">Not Selected</p>
                  )}
                </div>
              </div>

              {/* Arrangements Grid */}
              <div className="rounded-2xl border border-[#EAE2D6] bg-[#FAF7F2]/60 p-4">
                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#6A1B1B]">
                  Counts &amp; Hall Requirements
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-xs text-[#7B6B63]">Expected Thaals</span>
                    <p className="font-bold text-[#231917]">{event.thaalCount}</p>
                  </div>
                  <div>
                    <span className="text-xs text-[#7B6B63]">Sarkari Sets</span>
                    <p className="font-bold text-[#231917]">
                      {event.sarkariThaalSet}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#7B6B63]">Tables &amp; Chairs</span>
                    <p className="font-bold text-[#231917]">
                      {event.tablesAndChairs}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#7B6B63]">Chilamchi-Lota</span>
                    <p className="font-bold text-[#231917]">
                      {event.extraChilamchiLota}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#7B6B63]">Gas Cylinders</span>
                    <p className="font-bold text-[#231917]">
                      {event.gasCount || 0}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#7B6B63]">AC Start Time</span>
                    <p className="font-bold text-[#231917]">
                      {event.acStartTime || "Not Needed"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#7B6B63]">Guest Arrival</span>
                    <p className="font-bold text-[#231917]">
                      {event.partyTime || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-[#7B6B63]">Actual Thaals Done</span>
                    <p className="font-bold text-[#231917]">
                      {event.totalThaalsDone ?? "Pending"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 border-t border-[#EAE2D6] pt-3">
                  {event.crockeryRequired ? (
                    <Badge tone="brass">Store Crockery Needed</Badge>
                  ) : null}
                  {event.mic ? <Badge tone="neutral">Sound / Mic</Badge> : null}
                  {event.bhaiSaabIzzan ? (
                    <Badge tone="maroon">Bhai Saab Izzan</Badge>
                  ) : null}
                  {event.benSaabIzzan ? (
                    <Badge tone="maroon">Ben Saab Izzan</Badge>
                  ) : null}
                  {event.muraqebeenIzzan ? (
                    <Badge tone="maroon">Muraqebeen Izzan</Badge>
                  ) : null}
                  {event.thaalForDevri ? (
                    <Badge tone="neutral">Thaal for Devri</Badge>
                  ) : null}
                  {event.paat ? <Badge tone="neutral">Paat Setup</Badge> : null}
                  {event.masjidLight ? (
                    <Badge tone="neutral">Masjid Light</Badge>
                  ) : null}
                </div>

                {event.menu ? (
                  <div className="mt-3 border-t border-[#EAE2D6] pt-3 text-xs">
                    <span className="font-semibold text-[#6A1B1B]">Menu: </span>
                    <span className="text-[#3D2E2A]">{event.menu}</span>
                  </div>
                ) : null}
              </div>
            </CardBody>

            {/* Compact, proportional inline status toolbar (replaces stretched w-full buttons card) */}
            {canEdit ? (
              <CardFooter className="bg-[#FAF7F2]/65">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-xs font-semibold text-[#6E5D55]">
                    Quick Status:
                  </span>
                  {event.status !== "COMPLETED" ? (
                    <Button
                      variant="success"
                      size="xs"
                      loading={statusBusy}
                      leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      onClick={() => handleStatusChange("COMPLETED")}
                    >
                      Mark Completed
                    </Button>
                  ) : null}

                  {event.status !== "CANCELLED" ? (
                    <Button
                      variant="secondary"
                      size="xs"
                      loading={statusBusy}
                      leftIcon={<XCircle className="h-3.5 w-3.5 text-[#991B1B]" />}
                      onClick={() => handleStatusChange("CANCELLED")}
                    >
                      Cancel Booking
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="xs"
                      loading={statusBusy}
                      leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
                      onClick={() => handleStatusChange("BOOKED")}
                    >
                      Restore to Booked
                    </Button>
                  )}
                </div>

                {canDelete ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-[#991B1B] hover:bg-[#FDF0F0] hover:text-[#7F1D1D]"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    Delete Booking
                  </Button>
                ) : null}
              </CardFooter>
            ) : null}
          </Card>

          {/* Store Allocations Summary */}
          <Card>
            <CardHeader
              title="Store Vessels Issued & Returned"
              subtitle="Track Thaals, vessels, and crockery taken from the Jamaat store"
              action={
                canManageVessels ? (
                  <Link
                    href={`/events/${encodeURIComponent(event.id)}/inventory`}
                  >
                    <Button size="sm" variant="secondary">
                      Give Out / Return Items
                    </Button>
                  </Link>
                ) : undefined
              }
            />
            <CardBody className="p-0">
              {!event.allocations || event.allocations.length === 0 ? (
                <div className="p-6 text-center text-sm text-[#7B6B63]">
                  No store vessels have been issued to this booking yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#F3EFE6] text-xs uppercase text-[#5E4F4A]">
                      <tr>
                        <th className="px-4 py-3">Item</th>
                        <th className="px-4 py-3 text-right">Given Out</th>
                        <th className="px-4 py-3 text-right">Returned</th>
                        <th className="px-4 py-3 text-right">Missing</th>
                        <th className="px-4 py-3 text-right">Still With Booker</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE2D6]">
                      {event.allocations.map((a) => {
                        const missing = Math.max(0, a.lostQty - a.recoveredQty);
                        const pending = Math.max(
                          0,
                          a.issuedQty - a.returnedQty - missing
                        );
                        return (
                          <tr key={a.id}>
                            <td className="px-4 py-3 font-medium">
                              {a.itemName}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {a.issuedQty} {a.unit}
                            </td>
                            <td className="px-4 py-3 text-right text-[#2A6041]">
                              {a.returnedQty} {a.unit}
                            </td>
                            <td className="px-4 py-3 text-right text-[#991B1B]">
                              {missing} {a.unit}
                            </td>
                            <td className="px-4 py-3 text-right font-bold">
                              {pending} {a.unit}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader
              title="Booking Activity History"
              subtitle="All changes and vessel movements recorded for this function"
            />
            <CardBody className="space-y-2.5">
              {logs.length === 0 ? (
                <p className="text-sm text-[#7B6B63]">No history entries yet.</p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAF7F2] px-4 py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#231917]">
                        {log.summary}
                      </span>
                      <span className="ml-2 text-[#7B6B63]">
                        by {log.userName}
                      </span>
                    </div>
                    <span className="text-[#8C7B73]">
                      {formatIST(log.timestamp, "dd MMM yyyy, hh:mm a")}
                    </span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Charges & Compact Shareable QR Pass */}
        <div className="space-y-6 lg:col-span-4">
          <Card accentTop>
            <CardHeader
              title="Charges & Security Deposit"
              action={
                !event.amountsLocked && canEditCharges ? (
                  <Button
                    size="xs"
                    variant="secondary"
                    leftIcon={<IndianRupee className="h-3.5 w-3.5" />}
                    onClick={() => setChargesDrawerOpen(true)}
                  >
                    Edit Charges
                  </Button>
                ) : undefined
              }
            />
            <CardBody className="space-y-3">
              {event.amountsLocked ? (
                <div className="rounded-xl border border-dashed border-[#D9C398] bg-[#FAF7F2] p-5 text-center">
                  <Lock className="mx-auto h-6 w-6 text-[#6A1B1B]" />
                  <p className="mt-2 text-sm font-semibold text-[#231917]">
                    {canViewCharges ? "Amounts Hidden" : "Charges Restricted"}
                  </p>
                  <p className="mt-1 text-xs text-[#6E5D55]">
                    {canViewCharges
                      ? "Use the \u201CShow Charges (Email Code)\u201D button above to verify your email and view or edit booking amounts."
                      : "Only authorised accounts with the Event Charges module enabled can view or unlock booking amounts."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#6E5D55]">
                      Thaals ({event.thaalCount} × {formatRupees(event.thaalRate)})
                    </span>
                    <span className="font-semibold">
                      {formatRupees(event.thaalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6E5D55]">
                      Sarkari ({event.sarkariThaalSet} ×{" "}
                      {formatRupees(event.sarkariRate)})
                    </span>
                    <span className="font-semibold">
                      {formatRupees(event.sarkariAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6E5D55]">Kitchen / Gas</span>
                    <span className="font-semibold">
                      {formatRupees(event.kitchenCharge)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6E5D55]">Decoration Charge</span>
                    <span className="font-semibold">
                      {formatRupees(event.decorationCharge)}
                    </span>
                  </div>
                  {event.hallCharges
                    ? Object.entries(event.hallCharges).map(([hName, amt]) => (
                        <div key={hName} className="flex justify-between">
                          <span className="text-[#6E5D55]">{hName}</span>
                          <span className="font-semibold">
                            {formatRupees(amt)}
                          </span>
                        </div>
                      ))
                    : null}
                  <div className="flex justify-between">
                    <span className="text-[#6E5D55]">Other Charges</span>
                    <span className="font-semibold">
                      {formatRupees(event.otherCharge)}
                    </span>
                  </div>

                  <div className="flex justify-between border-t border-[#EAE2D6] pt-2.5 text-base font-bold text-[#231917]">
                    <span>Total Charges</span>
                    <span>{formatRupees(event.totalAmount)}</span>
                  </div>

                  <div className="rounded-xl border border-[#D9C398] bg-[#FBF6EB] p-3 text-xs">
                    <div className="flex justify-between font-semibold text-[#925708]">
                      <span>Refundable Security Deposit</span>
                      <span>{formatRupees(event.depositAmount)}</span>
                    </div>
                    <div className="mt-1 text-[#6E5D55]">
                      Status:{" "}
                      <strong>
                        {event.depositStatus === "REFUNDED"
                          ? "Returned to Booker"
                          : event.depositStatus === "HELD"
                            ? "Held with Office"
                            : "No Deposit"}
                      </strong>
                    </div>
                    {event.paymentMode ? (
                      <div className="mt-1 text-[#6E5D55]">
                        Payment: <strong>{event.paymentMode}</strong>
                        {event.transactionId
                          ? ` (Ref: ${event.transactionId})`
                          : ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Shareable Public QR Pass (compact side-by-side layout, natural button widths) */}
          <Card>
            <CardHeader
              title="Shareable Booking Pass"
              subtitle="Shows venue, timings & vessels without rupee amounts"
            />
            <CardBody>
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="shrink-0 rounded-2xl border border-[#EAE2D6] bg-white p-2.5 shadow-2xs">
                  <QRCode
                    value={fullPassUrl}
                    size={108}
                    fgColor="#231917"
                  />
                </div>
                <div className="flex flex-1 flex-col items-center text-center sm:items-start sm:text-left">
                  <p className="text-xs leading-relaxed text-[#5E4F4A]">
                    Share with the booker, caterer, or decorator so they can check
                    hall timings and vessel counts on their phone.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="xs"
                      variant="secondary"
                      leftIcon={<Copy className="h-3.5 w-3.5" />}
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}${publicPassPath}`
                        );
                        notify.success(
                          "Pass link copied",
                          "Shareable booking link copied."
                        );
                      }}
                    >
                      Copy Link
                    </Button>
                    <Link href={publicPassPath} target="_blank">
                      <Button
                        size="xs"
                        variant="ghost"
                        rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}
                      >
                        Preview Pass
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {!event.amountsLocked ? (
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

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => handleDelete(false)}
        danger
        loading={deleteBusy}
        title="Delete This Booking?"
        confirmLabel="Yes, Delete Booking"
        message="This will permanently remove this booking and its store item records. This action cannot be undone."
      />

      <ConfirmDialog
        open={Boolean(forceDeletePrompt)}
        onClose={() => setForceDeletePrompt(null)}
        onConfirm={() => handleDelete(true)}
        danger
        loading={deleteBusy}
        title="Unreturned Store Items Detected"
        confirmLabel="Force Delete & Restore Stock"
        message={forceDeletePrompt || ""}
      />
    </div>
  );
}
