import React, { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Clock, MapPin, Phone, Sparkles, Users } from "lucide-react";
import {
  formatIST,
  getMisriDate,
  isSelfEventVenue,
} from "@sezsec/shared";
import { getEventById } from "@sezsec/events/events.service";
import { listEventActivity } from "@sezsec/logs";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  KeelArchBanner,
  Skeleton,
} from "@sezsec/ui";

async function PublicEventPassContent({
  paramsPromise,
}: {
  paramsPromise: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await paramsPromise;
  const [event, logs] = await Promise.all([
    getEventById(decodeURIComponent(id), false),
    listEventActivity(decodeURIComponent(id)),
  ]);

  if (!event) notFound();

  const misri = getMisriDate(event.occasionDate);
  const isSelf = isSelfEventVenue(event.halls);

  return (
    <div className="w-full space-y-6 px-4 py-8 sm:px-6 lg:px-10">
      <KeelArchBanner
        arabicTitle="بسم الله الرحمن الرحيم"
        subtitle="Anjuman-e-Mohammedi, Secunderabad • Public Booking Summary"
      />

      <Card accentTop>
        <CardHeader
          title={event.description}
          subtitle={`Booking Ref: ${event.reference || event.id}`}
          arabicRight={misri.formattedAr}
          action={
            <Badge
              tone={
                event.status === "CANCELLED"
                  ? "crimson"
                  : event.status === "COMPLETED"
                    ? "sage"
                    : "maroon"
              }
            >
              {event.status === "COMPLETED"
                ? "Completed"
                : event.status === "CANCELLED"
                  ? "Cancelled"
                  : "Booked"}
            </Badge>
          }
        />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[#FAF7F2] p-3.5">
              <p className="text-xs text-[#7B6B63]">Booker Name</p>
              <p className="mt-0.5 font-semibold text-[#231917]">{event.name}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#5E4F4A]">
                <Phone className="h-3.5 w-3.5 text-[#6A1B1B]" />
                {event.mobile}
              </p>
            </div>
            <div className="rounded-xl bg-[#FAF7F2] p-3.5">
              <p className="text-xs text-[#7B6B63]">Date &amp; Time</p>
              <p className="mt-0.5 font-semibold text-[#231917]">
                {formatIST(event.occasionDate, "EEEE, dd MMMM yyyy")}
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#6A1B1B]">
                <Clock className="h-3.5 w-3.5" />
                {event.occasionTime} • {misri.formattedEn}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#EAE2D6] p-3.5">
              <p className="text-xs text-[#7B6B63]">Hall / Venue</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#231917]">
                <MapPin className="h-4 w-4 text-[#6A1B1B]" />
                {event.halls.join(", ") || "Self"}
              </p>
            </div>
            <div className="rounded-xl border border-[#EAE2D6] p-3.5">
              <p className="text-xs text-[#7B6B63]">Expected Thaals</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#231917]">
                <Users className="h-4 w-4 text-[#6A1B1B]" />
                {event.thaalCount} Thaals
              </p>
            </div>
            <div className="rounded-xl border border-[#EAE2D6] p-3.5">
              <p className="text-xs text-[#7B6B63]">Caterer</p>
              <p className="mt-1 text-sm font-semibold text-[#231917]">
                {event.catererName || "Self"}
              </p>
              {event.catererPhone ? (
                <p className="text-xs text-[#7B6B63]">{event.catererPhone}</p>
              ) : null}
            </div>
          </div>

          {event.decorations && !isSelf && event.decoratorName ? (
            <div className="flex items-center justify-between rounded-xl border border-[#D9C398] bg-[#FBF6EB] px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#B8924A]" />
                <span>
                  <strong>Decorator:</strong> {event.decoratorName}
                </span>
              </div>
              {event.decoratorPhone ? (
                <span className="text-xs font-medium text-[#6A1B1B]">
                  {event.decoratorPhone}
                </span>
              ) : null}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {event.allocations && event.allocations.length > 0 ? (
        <Card>
          <CardHeader
            title="Store Vessels & Crockery Status"
            subtitle="Items given out and returned for this occasion"
          />
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F3EFE6] text-xs uppercase text-[#5E4F4A]">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Given Out</th>
                  <th className="px-4 py-3 text-right">Returned</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE2D6]">
                {event.allocations.map((a) => {
                  const balance = Math.max(
                    0,
                    a.issuedQty - a.returnedQty - (a.lostQty - a.recoveredQty)
                  );
                  return (
                    <tr key={a.id}>
                      <td className="px-4 py-3 font-medium">{a.itemName}</td>
                      <td className="px-4 py-3 text-right">
                        {a.issuedQty} {a.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-[#2A6041]">
                        {a.returnedQty} {a.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {balance} {a.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      {logs.length > 0 ? (
        <Card>
          <CardHeader title="Recent Updates" />
          <CardBody className="space-y-2.5">
            {logs.slice(0, 12).map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF7F2] px-3.5 py-2.5 text-xs"
              >
                <span className="font-medium text-[#231917]">{l.summary}</span>
                <span className="shrink-0 text-[#8C7B73]">
                  {formatIST(l.timestamp, "dd MMM, hh:mm a")}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

export default function PublicEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="w-full space-y-4 px-4 py-8 sm:px-6 lg:px-10">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <PublicEventPassContent paramsPromise={params} />
    </Suspense>
  );
}
