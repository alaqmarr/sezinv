"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { formatRupees, isIgnoredConflictHall } from "@sezsec/shared";
import {
  Button,
  Drawer,
  Input,
  Select,
  Textarea,
  notify,
} from "@sezsec/ui";
import { calculateEventAmounts } from "./finance.helper";

export interface EditableEventChargesProps {
  eventId: string;
  thaalCount: number;
  sarkariThaalSet: number;
  halls: string[];
  initial: {
    thaalRate: number;
    thaalAmount: number;
    sarkariRate: number;
    sarkariAmount: number;
    kitchenCharge: number;
    decorationCharge: number;
    otherCharge: number;
    hallCharges: Record<string, number>;
    depositAmount: number;
    depositStatus: string;
    paymentMode: string | null;
    transactionId: string | null;
    amountNotes: string | null;
  };
}

export function EventChargesDrawer(props: {
  open: boolean;
  onClose: () => void;
  data: EditableEventChargesProps;
  onSaved?: () => void;
}) {
  const instanceKey = `${props.data.eventId}-${props.open ? "open" : "closed"}-${JSON.stringify(props.data.initial)}`;
  return <EventChargesDrawerInner key={instanceKey} {...props} />;
}

function EventChargesDrawerInner({
  open,
  onClose,
  data,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  data: EditableEventChargesProps;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [thaalRate, setThaalRate] = useState(String(data.initial.thaalRate || 0));
  const [thaalAmount, setThaalAmount] = useState(String(data.initial.thaalAmount || 0));
  const [sarkariRate, setSarkariRate] = useState(String(data.initial.sarkariRate || 0));
  const [sarkariAmount, setSarkariAmount] = useState(
    String(data.initial.sarkariAmount || 0)
  );
  const [kitchenCharge, setKitchenCharge] = useState(
    String(data.initial.kitchenCharge || 0)
  );
  const [decorationCharge, setDecorationCharge] = useState(
    String(data.initial.decorationCharge || 0)
  );
  const [otherCharge, setOtherCharge] = useState(String(data.initial.otherCharge || 0));
  const [hallCharges, setHallCharges] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const h of data.halls) {
      if (!isIgnoredConflictHall(h)) {
        map[h] = String(data.initial.hallCharges?.[h] || 0);
      }
    }
    return map;
  });
  const [depositAmount, setDepositAmount] = useState(
    String(data.initial.depositAmount || 0)
  );
  const [depositStatus, setDepositStatus] = useState(
    data.initial.depositStatus || "NONE"
  );
  const [paymentMode, setPaymentMode] = useState(data.initial.paymentMode || "CASH");
  const [transactionId, setTransactionId] = useState(
    data.initial.transactionId || ""
  );
  const [amountNotes, setAmountNotes] = useState(data.initial.amountNotes || "");
  const [saving, setSaving] = useState(false);

  const computed = useMemo(() => {
    const numericHallMap: Record<string, number> = {};
    for (const [k, v] of Object.entries(hallCharges)) {
      numericHallMap[k] = Number(v) || 0;
    }
    return calculateEventAmounts({
      thaalCount: data.thaalCount,
      sarkariThaalSet: data.sarkariThaalSet,
      thaalRate: Number(thaalRate) || 0,
      thaalAmount: Number(thaalAmount) || 0,
      sarkariRate: Number(sarkariRate) || 0,
      sarkariAmount: Number(sarkariAmount) || 0,
      kitchenCharge: Number(kitchenCharge) || 0,
      decorationCharge: Number(decorationCharge) || 0,
      otherCharge: Number(otherCharge) || 0,
      hallCharges: numericHallMap,
      depositAmount: Number(depositAmount) || 0,
      depositStatus,
      amountNotes,
    });
  }, [
    data.thaalCount,
    data.sarkariThaalSet,
    thaalRate,
    thaalAmount,
    sarkariRate,
    sarkariAmount,
    kitchenCharge,
    decorationCharge,
    otherCharge,
    hallCharges,
    depositAmount,
    depositStatus,
    amountNotes,
  ]);

  const cleanDigits = (val: string) => val.replace(/[^0-9]/g, "");

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(data.eventId)}/charges`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...computed,
          paymentMode,
          transactionId: paymentMode === "UPI" ? transactionId.trim() : "",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        notify.error("Could not save charges", json.error || "Please try again.");
        return;
      }
      notify.success("Charges saved", "Amounts have been saved to this booking.");
      onClose();
      router.refresh();
      onSaved?.();
    } catch {
      notify.error("Network error", "Failed to save charges.");
    } finally {
      setSaving(false);
    }
  };

  const chargeableHalls = data.halls.filter((h) => !isIgnoredConflictHall(h));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Edit Booking Charges & Deposit"
      subtitle="Saved directly on this booking and shown only after Email Code verification."
      widthClass="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            leftIcon={<Save className="h-4 w-4" />}
            loading={saving}
            onClick={handleSave}
          >
            Save Charges
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.thaalCount > 0 ? (
            <Input
              label={`Rate per Thaal (${data.thaalCount} Thaals)`}
              value={thaalRate}
              onChange={(e) => setThaalRate(cleanDigits(e.target.value))}
              leftAddon="₹"
              hint={`Total: ${formatRupees(computed.thaalAmount)}`}
            />
          ) : (
            <Input
              label="Thaal Charge (Lump Sum)"
              value={thaalAmount}
              onChange={(e) => setThaalAmount(cleanDigits(e.target.value))}
              leftAddon="₹"
            />
          )}

          {data.sarkariThaalSet > 0 ? (
            <Input
              label={`Rate per Sarkari Set (${data.sarkariThaalSet} Sets)`}
              value={sarkariRate}
              onChange={(e) => setSarkariRate(cleanDigits(e.target.value))}
              leftAddon="₹"
              hint={`Total: ${formatRupees(computed.sarkariAmount)}`}
            />
          ) : (
            <Input
              label="Sarkari Thaal Charge"
              value={sarkariAmount}
              onChange={(e) => setSarkariAmount(cleanDigits(e.target.value))}
              leftAddon="₹"
            />
          )}

          <Input
            label="Kitchen / Gas Charge"
            value={kitchenCharge}
            onChange={(e) => setKitchenCharge(cleanDigits(e.target.value))}
            leftAddon="₹"
          />

          <Input
            label="Decoration Charge"
            value={decorationCharge}
            onChange={(e) => setDecorationCharge(cleanDigits(e.target.value))}
            leftAddon="₹"
          />

          <Input
            label="Other / Extra Charges"
            value={otherCharge}
            onChange={(e) => setOtherCharge(cleanDigits(e.target.value))}
            leftAddon="₹"
          />
        </div>

        {chargeableHalls.length > 0 ? (
          <div className="space-y-3 rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-3.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6A1B1B]">
              Hall Charges
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {chargeableHalls.map((hallName) => (
                <Input
                  key={hallName}
                  label={hallName}
                  value={hallCharges[hallName] || "0"}
                  onChange={(e) =>
                    setHallCharges((prev) => ({
                      ...prev,
                      [hallName]: cleanDigits(e.target.value),
                    }))
                  }
                  leftAddon="₹"
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-3 rounded-xl border border-[#D9C398] bg-[#FBF6EB]/70 p-3.5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#6A1B1B]">
            Security Deposit &amp; Payment Details
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Refundable Security Deposit"
              value={depositAmount}
              onChange={(e) => setDepositAmount(cleanDigits(e.target.value))}
              leftAddon="₹"
            />
            <Select
              label="Deposit Status"
              value={depositStatus}
              onChange={setDepositStatus}
              options={[
                { value: "NONE", label: "No Deposit Taken" },
                { value: "HELD", label: "Deposit Collected (Held)" },
                { value: "REFUNDED", label: "Deposit Returned to Booker" },
              ]}
            />
            <Select
              label="Payment Method"
              value={paymentMode}
              onChange={setPaymentMode}
              options={[
                { value: "CASH", label: "Cash" },
                { value: "UPI", label: "UPI / Bank Transfer" },
              ]}
            />
            {paymentMode === "UPI" ? (
              <Input
                label="UPI / Transaction Reference No."
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. 429812349812"
              />
            ) : null}
          </div>
          <Textarea
            label="Charge Remarks (Optional)"
            value={amountNotes}
            onChange={(e) => setAmountNotes(e.target.value)}
            placeholder="Any note regarding payment, discount, or deposit..."
            className="min-h-[64px]"
          />
        </div>

        <div className="rounded-2xl border border-[#D9C398] bg-white p-4">
          <div className="flex items-center justify-between text-sm text-[#5E4F4A]">
            <span>Total Charges (Excluding Deposit)</span>
            <span className="text-base font-bold text-[#231917]">
              {formatRupees(computed.totalAmount)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-[#7B6B63]">
            <span>Refundable Deposit</span>
            <span className="font-semibold text-[#925708]">
              {formatRupees(computed.depositAmount)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-[#EAE2D6] pt-2.5 text-sm font-semibold text-[#6A1B1B]">
            <span>Total Collectible (With Deposit)</span>
            <span className="text-lg font-bold">
              {formatRupees(computed.totalAmount + computed.depositAmount)}
            </span>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
