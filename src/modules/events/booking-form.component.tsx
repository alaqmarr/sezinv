"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import {
  formatRupees,
  getISTTodayString,
  isIgnoredConflictHall,
  isSelfEventVenue,
  to24HourInput,
} from "@sezsec/shared";
import {
  ArabesqueDivider,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  HijriDatePicker,
  Input,
  MultiSelectPills,
  NumericStepper,
  Select,
  Switch,
  Textarea,
  notify,
} from "@sezsec/ui";
import { AmountAccessBar, calculateEventAmounts } from "@sezsec/finance";
import type { HallConflictWarning, PortalEvent } from "./events.types";

interface DirectoryEntry {
  id: string;
  name: string;
  phone: string;
}

export function EventBookingForm({
  mode,
  initialEvent,
  defaultDate,
  halls,
  caterers,
  decorators,
  amountsUnlocked,
}: {
  mode: "create" | "edit";
  initialEvent?: PortalEvent;
  defaultDate?: string;
  halls: Array<{ id: string; name: string }>;
  caterers: DirectoryEntry[];
  decorators: DirectoryEntry[];
  amountsUnlocked: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialEvent?.name || "");
  const [mobile, setMobile] = useState(initialEvent?.mobile || "");
  const [email, setEmail] = useState(initialEvent?.email || "");
  const [bookerSuggestions, setBookerSuggestions] = useState<
    Array<{ name: string; mobile: string; email: string | null }>
  >([]);

  const [occasionDate, setOccasionDate] = useState(
    initialEvent
      ? initialEvent.occasionDate.slice(0, 10)
      : defaultDate || getISTTodayString()
  );
  const [occasionTime, setOccasionTime] = useState(
    initialEvent ? to24HourInput(initialEvent.occasionTime) : "19:30"
  );
  const [description, setDescription] = useState(
    initialEvent?.description || ""
  );
  const [eventType, setEventType] = useState<"PRIVATE" | "PUBLIC">(
    initialEvent?.eventType || "PRIVATE"
  );
  const [status, setStatus] = useState<"BOOKED" | "COMPLETED" | "CANCELLED">(
    initialEvent?.status || "BOOKED"
  );
  const [razaGranted, setRazaGranted] = useState(
    initialEvent?.razaGranted ?? false
  );

  const [selectedHalls, setSelectedHalls] = useState<string[]>(
    initialEvent?.halls?.length ? initialEvent.halls : halls[0] ? [halls[0].name] : ["Self"]
  );
  const [hallCounts, setHallCounts] = useState<Record<string, number>>(
    initialEvent?.hallCounts || {}
  );
  const [conflicts, setConflicts] = useState<HallConflictWarning[]>([]);

  // Caterer
  const [catererPresetId, setCatererPresetId] = useState(
    initialEvent?.catererId || ""
  );
  const [catererName, setCatererName] = useState(
    initialEvent?.catererName || "Self"
  );
  const [catererPhone, setCatererPhone] = useState(
    initialEvent?.catererPhone || ""
  );

  // Decorations & Conditional Decorator Details
  const [decorations, setDecorations] = useState(
    initialEvent?.decorations ?? false
  );
  const [decoratorPresetId, setDecoratorPresetId] = useState(
    initialEvent?.decoratorId || ""
  );
  const [decoratorName, setDecoratorName] = useState(
    initialEvent?.decoratorName || ""
  );
  const [decoratorPhone, setDecoratorPhone] = useState(
    initialEvent?.decoratorPhone || ""
  );

  // Counts & Arrangements
  const [thaalCount, setThaalCount] = useState(initialEvent?.thaalCount ?? 0);
  const [totalThaalsDone, setTotalThaalsDone] = useState<number>(
    initialEvent?.totalThaalsDone ?? 0
  );
  const [sarkariThaalSet, setSarkariThaalSet] = useState(
    initialEvent?.sarkariThaalSet ?? 0
  );
  const [tablesAndChairs, setTablesAndChairs] = useState(
    initialEvent?.tablesAndChairs ?? 0
  );
  const [extraChilamchiLota, setExtraChilamchiLota] = useState(
    initialEvent?.extraChilamchiLota ?? 0
  );
  const [gasCount, setGasCount] = useState(initialEvent?.gasCount ?? 0);

  const [acStartTime, setAcStartTime] = useState(
    initialEvent?.acStartTime ? to24HourInput(initialEvent.acStartTime) : ""
  );
  const [partyTime, setPartyTime] = useState(
    initialEvent?.partyTime ? to24HourInput(initialEvent.partyTime) : ""
  );
  const [menu, setMenu] = useState(initialEvent?.menu || "");

  const [mic, setMic] = useState(initialEvent?.mic ?? false);
  const [crockeryRequired, setCrockeryRequired] = useState(
    initialEvent?.crockeryRequired ?? false
  );
  const [bhaiSaabIzzan, setBhaiSaabIzzan] = useState(
    initialEvent?.bhaiSaabIzzan ?? false
  );
  const [benSaabIzzan, setBenSaabIzzan] = useState(
    initialEvent?.benSaabIzzan ?? false
  );
  const [muraqebeenIzzan, setMuraqebeenIzzan] = useState(
    initialEvent?.muraqebeenIzzan ?? false
  );
  const [thaalForDevri, setThaalForDevri] = useState(
    initialEvent?.thaalForDevri ?? false
  );
  const [paat, setPaat] = useState(initialEvent?.paat ?? false);
  const [masjidLight, setMasjidLight] = useState(
    initialEvent?.masjidLight ?? false
  );

  // Charges (stored decrypted in SQLite; visible in Edit mode only after Email OTP)
  const canEditChargesNow = mode === "create" || amountsUnlocked;
  const [thaalRate, setThaalRate] = useState(
    String(initialEvent?.thaalRate || 0)
  );
  const [sarkariRate, setSarkariRate] = useState(
    String(initialEvent?.sarkariRate || 0)
  );
  const [kitchenCharge, setKitchenCharge] = useState(
    String(initialEvent?.kitchenCharge || 0)
  );
  const [decorationCharge, setDecorationCharge] = useState(
    String(initialEvent?.decorationCharge || 0)
  );
  const [otherCharge, setOtherCharge] = useState(
    String(initialEvent?.otherCharge || 0)
  );
  const [hallCharges, setHallCharges] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (initialEvent?.hallCharges) {
      for (const [k, v] of Object.entries(initialEvent.hallCharges)) {
        out[k] = String(v || 0);
      }
    }
    return out;
  });
  const [depositAmount, setDepositAmount] = useState(
    String(initialEvent?.depositAmount || 0)
  );
  const [depositStatus, setDepositStatus] = useState<"NONE" | "HELD" | "REFUNDED">(
    initialEvent?.depositStatus || "NONE"
  );
  const [paymentMode, setPaymentMode] = useState(
    initialEvent?.paymentMode || "CASH"
  );
  const [transactionId, setTransactionId] = useState(
    initialEvent?.transactionId || ""
  );
  const [amountNotes, setAmountNotes] = useState(
    initialEvent?.amountNotes || ""
  );

  const [submitting, setSubmitting] = useState(false);

  const isSelfVenue = useMemo(
    () => isSelfEventVenue(selectedHalls),
    [selectedHalls]
  );
  const requiresDecoratorDetails = decorations && !isSelfVenue;

  // Booker lookup by mobile
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (mode !== "create" || mobile.trim().length < 4) {
        setBookerSuggestions([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/lookup/mobile?mobile=${encodeURIComponent(mobile.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          setBookerSuggestions(data.results || []);
        }
      } catch {
        // Ignore lookup error
      }
    }, 260);
    return () => clearTimeout(timer);
  }, [mobile, mode]);

  // Live hall conflict check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!occasionDate || !occasionTime || selectedHalls.length === 0) {
        setConflicts([]);
        return;
      }
      try {
        const res = await fetch("/api/events/check-conflict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            occasionDate,
            occasionTime,
            halls: selectedHalls,
            excludeEventId: initialEvent?.id,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setConflicts(data.conflicts || []);
        }
      } catch {
        // Ignore transient network errors
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [occasionDate, occasionTime, selectedHalls, initialEvent?.id]);

  const hallOptions = useMemo(() => {
    const base = halls.map((h) => ({ value: h.name, label: h.name }));
    if (!base.some((b) => b.value.toLowerCase() === "self")) {
      base.push({
        value: "Self",
        label: "Self (Home / Outside Venue)",
      });
    }
    return base;
  }, [halls]);

  const chargeableHalls = useMemo(
    () => selectedHalls.filter((h) => !isIgnoredConflictHall(h)),
    [selectedHalls]
  );

  const initialThaalAmount = initialEvent?.thaalAmount;
  const initialSarkariAmount = initialEvent?.sarkariAmount;

  const computedAmounts = useMemo(() => {
    const hallMap: Record<string, number> = {};
    for (const h of chargeableHalls) {
      hallMap[h] = Number(hallCharges[h]) || 0;
    }
    return calculateEventAmounts({
      thaalCount,
      sarkariThaalSet,
      thaalRate: Number(thaalRate) || 0,
      thaalAmount:
        Number(thaalRate) === 0 && initialThaalAmount
          ? initialThaalAmount
          : undefined,
      sarkariRate: Number(sarkariRate) || 0,
      sarkariAmount:
        Number(sarkariRate) === 0 && initialSarkariAmount
          ? initialSarkariAmount
          : undefined,
      kitchenCharge: Number(kitchenCharge) || 0,
      decorationCharge: Number(decorationCharge) || 0,
      otherCharge: Number(otherCharge) || 0,
      hallCharges: hallMap,
      depositAmount: Number(depositAmount) || 0,
      depositStatus,
      amountNotes,
    });
  }, [
    thaalCount,
    sarkariThaalSet,
    thaalRate,
    sarkariRate,
    kitchenCharge,
    decorationCharge,
    otherCharge,
    chargeableHalls,
    hallCharges,
    depositAmount,
    depositStatus,
    amountNotes,
    initialThaalAmount,
    initialSarkariAmount,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (requiresDecoratorDetails) {
      if (decoratorName.trim().length < 2 || decoratorPhone.trim().length < 8) {
        notify.warning(
          "Decorator details needed",
          "Please enter both the Decorator Name and Mobile Number since Decorations is selected for a hall booking."
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        mobile,
        email,
        occasionDate,
        occasionTime,
        description,
        halls: selectedHalls,
        hallCounts,
        catererName: catererName || "Self",
        catererPhone,
        catererId: catererPresetId || null,
        decorations,
        decoratorName: requiresDecoratorDetails ? decoratorName : "",
        decoratorPhone: requiresDecoratorDetails ? decoratorPhone : "",
        decoratorId: requiresDecoratorDetails ? decoratorPresetId || null : null,
        thaalCount,
        totalThaalsDone: mode === "edit" && totalThaalsDone > 0 ? totalThaalsDone : null,
        sarkariThaalSet,
        tablesAndChairs,
        extraChilamchiLota,
        gasCount: gasCount || null,
        acStartTime,
        partyTime,
        menu,
        mic,
        crockeryRequired,
        bhaiSaabIzzan,
        benSaabIzzan,
        muraqebeenIzzan,
        thaalForDevri,
        paat,
        masjidLight,
        eventType,
        status,
        razaGranted,
      };

      if (canEditChargesNow) {
        payload.thaalRate = computedAmounts.thaalRate;
        payload.thaalAmount = computedAmounts.thaalAmount;
        payload.sarkariRate = computedAmounts.sarkariRate;
        payload.sarkariAmount = computedAmounts.sarkariAmount;
        payload.kitchenCharge = computedAmounts.kitchenCharge;
        payload.decorationCharge = computedAmounts.decorationCharge;
        payload.otherCharge = computedAmounts.otherCharge;
        payload.hallCharges = computedAmounts.hallCharges;
        payload.depositAmount = computedAmounts.depositAmount;
        payload.depositStatus = computedAmounts.depositStatus;
        payload.paymentMode = paymentMode;
        payload.transactionId = paymentMode === "UPI" ? transactionId : "";
        payload.amountNotes = amountNotes;
      }

      const url =
        mode === "create"
          ? "/api/events"
          : `/api/events/${encodeURIComponent(initialEvent!.id)}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        notify.error("Could not save booking", data.error || "Please check all fields.");
        return;
      }

      if (mode === "create") {
        notify.success(
          "Booking saved — opening print page",
          "Charges remain visible on this booking for the next 10 minutes so you can print right away."
        );
        router.push(`/events/${encodeURIComponent(data.event.id)}/print`);
      } else {
        notify.success(
          "Booking updated",
          `${description} for ${name} has been updated.`
        );
        router.push(`/events/${encodeURIComponent(data.event.id)}`);
      }
      router.refresh();
    } catch {
      notify.error("Network error", "Could not save booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const digitsOnly = (s: string) => s.replace(/[^0-9]/g, "");

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 1. Booker & Occasion Details */}
      <Card accentTop>
        <CardHeader
          title="1. Booker & Occasion Details"
          subtitle="Enter the member's contact details and occasion date"
          arabicRight="تفاصيل المناسبة"
        />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="relative">
              <Input
                label="Mobile Number"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 9849012345"
              />
              {bookerSuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1.5 rounded-xl border border-[#D9C398] bg-[#FBF6EB] p-2.5 shadow-lg">
                  <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                    <p className="text-[11px] font-semibold text-[#6A1B1B]">
                      Previous booker match — click to fill:
                    </p>
                    <button
                      type="button"
                      onClick={() => setBookerSuggestions([])}
                      className="rounded-md p-0.5 text-[#7B6B63] hover:bg-white hover:text-[#231917] cursor-pointer"
                      aria-label="Dismiss suggestions"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {bookerSuggestions.map((b) => (
                      <button
                        key={`${b.mobile}-${b.name}`}
                        type="button"
                        onClick={() => {
                          setName(b.name);
                          setMobile(b.mobile);
                          if (b.email) setEmail(b.email);
                          setBookerSuggestions([]);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D9C398] bg-white px-2.5 py-1 text-xs font-medium text-[#231917] hover:bg-[#6A1B1B] hover:text-white cursor-pointer"
                      >
                        <UserCheck className="h-3 w-3" />
                        {b.name} ({b.mobile})
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <Input
              label="Booker Full Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shk. Hatim Bhai"
            />

            <Input
              label="Email Address (Optional)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="For booking confirmation email"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="Occasion / Function Name"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Walima, Darees, Misaaq, Ziyafat"
            />

            <HijriDatePicker
              label="Occasion Date"
              required
              value={occasionDate}
              onChange={setOccasionDate}
            />

            <Input
              label="Occasion Start Time"
              type="time"
              required
              value={occasionTime}
              onChange={(e) => setOccasionTime(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select
              label="Function Type"
              value={eventType}
              onChange={(v) => setEventType(v as "PRIVATE" | "PUBLIC")}
              options={[
                { value: "PRIVATE", label: "Private Family Function" },
                { value: "PUBLIC", label: "Public Jamaat Miqaat" },
              ]}
            />
            {mode === "edit" ? (
              <Select
                label="Booking Status"
                value={status}
                onChange={(v) =>
                  setStatus(v as "BOOKED" | "COMPLETED" | "CANCELLED")
                }
                options={[
                  { value: "BOOKED", label: "Booked (Upcoming / Active)" },
                  { value: "COMPLETED", label: "Completed" },
                  { value: "CANCELLED", label: "Cancelled" },
                ]}
              />
            ) : null}
            <div className="md:pt-6">
              <Switch
                checked={razaGranted}
                onChange={setRazaGranted}
                label="Raza Granted"
                description="Mark once office / Amil Saheb Raza is confirmed"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 2. Hall Selection & Availability */}
      <Card accentTop>
        <CardHeader
          title="2. Hall / Venue Selection"
          subtitle="Select one or more Jamaat halls, or choose 'Self' if the function is at home"
        />
        <CardBody className="space-y-4">
          <MultiSelectPills
            label="Select Hall(s) *"
            options={hallOptions}
            values={selectedHalls}
            onChange={(vals) => {
              // If choosing Self, keep Self exclusive unless another hall is picked
              if (vals.includes("Self") && !selectedHalls.includes("Self")) {
                setSelectedHalls(["Self"]);
              } else {
                const withoutSelf = vals.filter((v) => v !== "Self");
                setSelectedHalls(withoutSelf.length > 0 ? withoutSelf : vals);
              }
            }}
          />

          {conflicts.length > 0 ? (
            <div className="rounded-xl border border-[#EEC2C2] bg-[#FDF0F0] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#991B1B]">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Time Slot Overlap Detected on Selected Hall(s)</span>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-[#7F1D1D]">
                {conflicts.map((c) => (
                  <li key={c.eventId}>
                    • <strong>{c.description}</strong> ({c.bookerName}) at{" "}
                    <strong>{c.occasionTime}</strong> in{" "}
                    <strong>{c.overlappingHalls.join(", ")}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ) : chargeableHalls.length > 0 ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#B7DBC3] bg-[#EAF5EE] px-3.5 py-2 text-xs font-medium text-[#23583A]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Selected hall(s) are free for this date and time.</span>
            </div>
          ) : null}

          {chargeableHalls.length > 1 ? (
            <div className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-4">
              <p className="mb-3 text-xs font-semibold text-[#6A1B1B]">
                Thaal Split Across Selected Halls (Optional)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {chargeableHalls.map((h) => (
                  <NumericStepper
                    key={h}
                    label={`${h} Thaals`}
                    value={hallCounts[h] || 0}
                    onChange={(n) =>
                      setHallCounts((prev) => ({ ...prev, [h]: n }))
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* 3. Caterer & Decorator Details */}
      <Card accentTop>
        <CardHeader
          title="3. Caterer & Decorations"
          subtitle="Select from saved contacts or enter details directly"
        />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select
              label="Choose Saved Caterer"
              value={catererPresetId}
              placeholder="Pick caterer or enter manually..."
              onChange={(id) => {
                setCatererPresetId(id);
                if (id === "__self__") {
                  setCatererName("Self");
                  setCatererPhone("");
                  return;
                }
                const found = caterers.find((c) => c.id === id);
                if (found) {
                  setCatererName(found.name);
                  setCatererPhone(found.phone);
                }
              }}
              options={[
                { value: "__self__", label: "Self / Home Cooking" },
                ...caterers.map((c) => ({
                  value: c.id,
                  label: c.name,
                  sublabel: c.phone,
                })),
              ]}
            />
            <Input
              label="Caterer Name"
              value={catererName}
              onChange={(e) => setCatererName(e.target.value)}
              placeholder="Caterer name or Self"
            />
            <Input
              label="Caterer Mobile Number"
              value={catererPhone}
              onChange={(e) => setCatererPhone(e.target.value)}
              placeholder="Caterer contact number"
            />
          </div>

          <ArabesqueDivider label="Decorations" />

          <Switch
            checked={decorations}
            onChange={setDecorations}
            label="Decorations Selected for This Function"
            description={
              isSelfVenue
                ? "Self / home venue selected — decorator details are not required."
                : "When turned on for a Jamaat hall booking, Decorator Name & Mobile Number are required."
            }
          />

          {requiresDecoratorDetails ? (
            <div className="rounded-2xl border border-[#D9C398] bg-[#FBF6EB]/75 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6A1B1B]">
                  <Sparkles className="h-4 w-4 text-[#B8924A]" />
                  <span>Decorator Details (Required for Hall Decoration)</span>
                </div>
                <Badge tone="brass">Required</Badge>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Select
                  label="Choose Saved Decorator"
                  value={decoratorPresetId}
                  placeholder="Pick saved decorator or type new..."
                  onChange={(id) => {
                    setDecoratorPresetId(id);
                    const found = decorators.find((d) => d.id === id);
                    if (found) {
                      setDecoratorName(found.name);
                      setDecoratorPhone(found.phone);
                    }
                  }}
                  options={decorators.map((d) => ({
                    value: d.id,
                    label: d.name,
                    sublabel: d.phone,
                  }))}
                />
                <Input
                  label="Decorator Name"
                  required
                  value={decoratorName}
                  onChange={(e) => setDecoratorName(e.target.value)}
                  placeholder="Enter decorator name"
                />
                <Input
                  label="Decorator Mobile Number"
                  required
                  value={decoratorPhone}
                  onChange={(e) => setDecoratorPhone(e.target.value)}
                  placeholder="Enter decorator phone number"
                />
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* 4. Thaals, Timings & Hall Arrangements */}
      <Card accentTop>
        <CardHeader
          title="4. Thaals & Hall Arrangements"
          subtitle="Specify counts and hall facilities needed for the occasion"
        />
        <CardBody className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <NumericStepper
              label="Expected Thaals"
              value={thaalCount}
              onChange={setThaalCount}
              suffix="Thaals"
            />
            <NumericStepper
              label="Sarkari Thaal Sets"
              value={sarkariThaalSet}
              onChange={setSarkariThaalSet}
              suffix="Sets"
            />
            <NumericStepper
              label="Tables & Chairs"
              value={tablesAndChairs}
              onChange={setTablesAndChairs}
              suffix="Sets"
            />
            <NumericStepper
              label="Extra Chilamchi-Lota"
              value={extraChilamchiLota}
              onChange={setExtraChilamchiLota}
              suffix="Pcs"
            />
            <NumericStepper
              label="Gas Cylinders"
              value={gasCount}
              onChange={setGasCount}
              suffix="Cyl"
            />
          </div>

          {mode === "edit" ? (
            <div className="max-w-xs">
              <NumericStepper
                label="Actual Thaals Served (Post-Event)"
                value={totalThaalsDone}
                onChange={setTotalThaalsDone}
                suffix="Thaals"
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="AC Start Time (If Needed)"
              type="time"
              value={acStartTime}
              onChange={(e) => setAcStartTime(e.target.value)}
            />
            <Input
              label="Guest Arrival Time"
              type="time"
              value={partyTime}
              onChange={(e) => setPartyTime(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Switch
              checked={crockeryRequired}
              onChange={setCrockeryRequired}
              label="Store Vessels / Crockery"
              description="Needs Thaals/vessels from store"
            />
            <Switch
              checked={mic}
              onChange={setMic}
              label="Sound / Microphone"
              description="Speaker & mic setup in hall"
            />
            <Switch
              checked={bhaiSaabIzzan}
              onChange={setBhaiSaabIzzan}
              label="Bhai Saab Izzan"
            />
            <Switch
              checked={benSaabIzzan}
              onChange={setBenSaabIzzan}
              label="Ben Saab Izzan"
            />
            <Switch
              checked={muraqebeenIzzan}
              onChange={setMuraqebeenIzzan}
              label="Muraqebeen Izzan"
            />
            <Switch
              checked={thaalForDevri}
              onChange={setThaalForDevri}
              label="Thaal for Devri"
            />
            <Switch
              checked={paat}
              onChange={setPaat}
              label="Paat Setup"
            />
            <Switch
              checked={masjidLight}
              onChange={setMasjidLight}
              label="Masjid Light"
            />
          </div>

          <Textarea
            label="Food Menu / Special Notes (Optional)"
            value={menu}
            onChange={(e) => setMenu(e.target.value)}
            placeholder="e.g. Mithas, Kharas, Biryani, Soup..."
          />
        </CardBody>
      </Card>

      {/* 5. Charges & Deposit */}
      <Card accentTop>
        <CardHeader
          title="5. Booking Charges & Security Deposit"
          subtitle="Saved with the booking and protected by email verification"
        />
        <CardBody className="space-y-4">
          {!canEditChargesNow ? (
            <AmountAccessBar unlocked={false} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <Input
                  label={`Rate per Thaal (${thaalCount})`}
                  value={thaalRate}
                  onChange={(e) => setThaalRate(digitsOnly(e.target.value))}
                  leftAddon="₹"
                  hint={`Total: ${formatRupees(computedAmounts.thaalAmount)}`}
                />
                <Input
                  label={`Rate per Sarkari (${sarkariThaalSet})`}
                  value={sarkariRate}
                  onChange={(e) => setSarkariRate(digitsOnly(e.target.value))}
                  leftAddon="₹"
                  hint={`Total: ${formatRupees(computedAmounts.sarkariAmount)}`}
                />
                <Input
                  label="Kitchen / Gas Charge"
                  value={kitchenCharge}
                  onChange={(e) => setKitchenCharge(digitsOnly(e.target.value))}
                  leftAddon="₹"
                />
                <Input
                  label="Decoration Charge"
                  value={decorationCharge}
                  onChange={(e) => setDecorationCharge(digitsOnly(e.target.value))}
                  leftAddon="₹"
                />
                <Input
                  label="Other Charges"
                  value={otherCharge}
                  onChange={(e) => setOtherCharge(digitsOnly(e.target.value))}
                  leftAddon="₹"
                />
              </div>

              {chargeableHalls.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {chargeableHalls.map((h) => (
                    <Input
                      key={h}
                      label={`${h} Charge`}
                      value={hallCharges[h] || "0"}
                      onChange={(e) =>
                        setHallCharges((prev) => ({
                          ...prev,
                          [h]: digitsOnly(e.target.value),
                        }))
                      }
                      leftAddon="₹"
                    />
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <Input
                  label="Refundable Deposit"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(digitsOnly(e.target.value))}
                  leftAddon="₹"
                />
                <Select
                  label="Deposit Status"
                  value={depositStatus}
                  onChange={(v) =>
                    setDepositStatus(v as "NONE" | "HELD" | "REFUNDED")
                  }
                  options={[
                    { value: "NONE", label: "No Deposit" },
                    { value: "HELD", label: "Deposit Collected" },
                    { value: "REFUNDED", label: "Deposit Returned" },
                  ]}
                />
                <Select
                  label="Payment Method"
                  value={paymentMode}
                  onChange={setPaymentMode}
                  options={[
                    { value: "CASH", label: "Cash" },
                    { value: "UPI", label: "UPI / Online Transfer" },
                  ]}
                />
                {paymentMode === "UPI" ? (
                  <Input
                    label="UPI Reference No."
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="Transaction Ref ID"
                  />
                ) : null}
              </div>

              <Input
                label="Charge Notes (Optional)"
                value={amountNotes}
                onChange={(e) => setAmountNotes(e.target.value)}
                placeholder="Any payment or deposit remarks..."
              />

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#D9C398] bg-[#FBF6EB] px-4 py-3 text-sm">
                <div>
                  <span className="text-[#5E4F4A]">Charges Total: </span>
                  <strong className="text-[#231917]">
                    {formatRupees(computedAmounts.totalAmount)}
                  </strong>
                  <span className="mx-2 text-[#C5B397]">|</span>
                  <span className="text-[#5E4F4A]">Refundable Deposit: </span>
                  <strong className="text-[#925708]">
                    {formatRupees(computedAmounts.depositAmount)}
                  </strong>
                </div>
                <div className="text-base font-bold text-[#6A1B1B]">
                  Total Collectible:{" "}
                  {formatRupees(
                    computedAmounts.totalAmount + computedAmounts.depositAmount
                  )}
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button variant="primary" size="lg" type="submit" loading={submitting}>
          {mode === "create"
            ? "Save & Open Printable Form"
            : "Save Booking Changes"}
        </Button>
      </div>
    </form>
  );
}
