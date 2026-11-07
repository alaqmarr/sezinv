"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  DEFAULT_BOOKING_GUIDELINES,
  type BookingGuidelinesConfig,
} from "@sezsec/print/dos-and-donts.constants";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Textarea,
  notify,
} from "@sezsec/ui";

export function GuidelinesSettingsPanel({
  initialWindowMinutes,
  initialGuidelines,
}: {
  initialWindowMinutes: number;
  initialGuidelines: BookingGuidelinesConfig;
}) {
  const router = useRouter();
  const [windowMinutes, setWindowMinutes] = useState(
    String(initialWindowMinutes)
  );
  const [savingWindow, setSavingWindow] = useState(false);

  const [dos, setDos] = useState<string[]>(initialGuidelines.dos);
  const [donts, setDonts] = useState<string[]>(initialGuidelines.donts);
  const [footerNote, setFooterNote] = useState<string>(
    initialGuidelines.footerNote
  );
  const [newDoText, setNewDoText] = useState("");
  const [newDontText, setNewDontText] = useState("");
  const [savingGuidelines, setSavingGuidelines] = useState(false);

  const handleSaveGap = async (e: React.FormEvent) => {
    e.preventDefault();
    const mins = Number(windowMinutes);
    if (!Number.isFinite(mins) || mins < 0 || mins > 720) {
      notify.warning(
        "Check gap minutes",
        "Please enter a number between 0 and 720 minutes."
      );
      return;
    }

    setSavingWindow(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingWindowMinutes: mins }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not save rule", data.error || "Please try again.");
        return;
      }
      notify.success(
        "Gap time updated",
        `Minimum gap between hall bookings set to ${data.bookingWindowMinutes} minutes.`
      );
      router.refresh();
    } catch {
      notify.error("Network error", "Could not save booking gap.");
    } finally {
      setSavingWindow(false);
    }
  };

  const handleSaveGuidelines = async () => {
    const cleanedDos = dos.map((s) => s.trim()).filter(Boolean);
    const cleanedDonts = donts.map((s) => s.trim()).filter(Boolean);
    if (cleanedDos.length === 0 || cleanedDonts.length === 0) {
      notify.warning(
        "Add at least one point",
        "Both Do's and Don'ts lists need at least one instruction."
      );
      return;
    }

    setSavingGuidelines(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guidelines: {
            dos: cleanedDos,
            donts: cleanedDonts,
            footerNote,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not save guidelines", data.error || "Try again.");
        return;
      }
      setDos(data.guidelines.dos);
      setDonts(data.guidelines.donts);
      setFooterNote(data.guidelines.footerNote);
      notify.success(
        "Do's & Don'ts saved",
        "All printed booking sheets and PDFs will now include these instructions."
      );
      router.refresh();
    } catch {
      notify.error("Network error", "Could not save Do's & Don'ts.");
    } finally {
      setSavingGuidelines(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSaveGap}>
        <Card accentTop>
          <CardHeader
            title="Time Gap Between Two Functions"
            subtitle="Used to warn staff when two bookings in the same hall are too close on the same day."
            arabicRight="الفاصل الزمني"
          />
          <CardBody className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
            <Input
              label="Minimum Cleaning & Preparation Gap (Minutes)"
              type="number"
              min={0}
              max={720}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(e.target.value)}
              leftAddon={<Clock className="h-4 w-4" />}
              hint="Example: 120 = 2 hours gap between bookings in the same hall"
            />
            <div className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-3.5 text-xs text-[#5E4F4A]">
              Assuming a standard 3-hour function, a{" "}
              <strong>{Number(windowMinutes) || 0}-minute</strong> gap helps
              ensure hall cleaning and table arrangement before the next family
              arrives.
            </div>
          </CardBody>
          <CardFooter>
            <span className="text-xs text-[#7B6B63]">
              Applies immediately when checking hall availability.
            </span>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={savingWindow}
              leftIcon={<Save className="h-4 w-4" />}
            >
              Save Gap Time
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader
          title="Printed Do's & Don'ts Page (Shared with Bookers)"
          subtitle="Printed automatically as Page 2 on every Booking Sheet and downloadable PDF."
          action={
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => {
                setDos(DEFAULT_BOOKING_GUIDELINES.dos);
                setDonts(DEFAULT_BOOKING_GUIDELINES.donts);
                setFooterNote(DEFAULT_BOOKING_GUIDELINES.footerNote);
                notify.info("Restored standard points", "Click Save Guidelines below to apply.");
              }}
            >
              Reset Standard Text
            </Button>
          }
        />
        <CardBody className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* DO'S */}
            <div className="space-y-3 rounded-2xl border border-[#C6DFCF] bg-[#F4FAF6]/70 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-[#23583A]">
                  Do&apos;s — Please Follow ({dos.length})
                </h4>
              </div>
              <div className="space-y-2">
                {dos.map((line, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="mt-2.5 w-5 shrink-0 text-xs font-bold text-[#23583A]">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={line}
                      onChange={(e) =>
                        setDos((prev) =>
                          prev.map((item, i) => (i === idx ? e.target.value : item))
                        )
                      }
                      className="min-h-9 flex-1 rounded-xl border border-[#CFE4D6] bg-white px-3 py-1.5 text-xs text-[#231917] focus:border-[#23583A] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDos((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="mt-1.5 rounded-lg p-1.5 text-[#8C7B73] hover:bg-[#FEE2E2] hover:text-[#991B1B] cursor-pointer"
                      title="Remove point"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newDoText}
                  onChange={(e) => setNewDoText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newDoText.trim()) {
                        setDos((prev) => [...prev, newDoText.trim()]);
                        setNewDoText("");
                      }
                    }
                  }}
                  placeholder="Add a new Do instruction..."
                  className="h-9 flex-1 rounded-xl border border-[#CFE4D6] bg-white px-3 text-xs text-[#231917] focus:border-[#23583A] focus:outline-none"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => {
                    if (!newDoText.trim()) return;
                    setDos((prev) => [...prev, newDoText.trim()]);
                    setNewDoText("");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* DON'TS */}
            <div className="space-y-3 rounded-2xl border border-[#EEC2C2] bg-[#FDF5F5]/70 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-[#991B1B]">
                  Don&apos;ts — Strictly Avoid ({donts.length})
                </h4>
              </div>
              <div className="space-y-2">
                {donts.map((line, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="mt-2.5 w-5 shrink-0 text-xs font-bold text-[#991B1B]">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={line}
                      onChange={(e) =>
                        setDonts((prev) =>
                          prev.map((item, i) => (i === idx ? e.target.value : item))
                        )
                      }
                      className="min-h-9 flex-1 rounded-xl border border-[#EED2D2] bg-white px-3 py-1.5 text-xs text-[#231917] focus:border-[#991B1B] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDonts((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="mt-1.5 rounded-lg p-1.5 text-[#8C7B73] hover:bg-[#FEE2E2] hover:text-[#991B1B] cursor-pointer"
                      title="Remove point"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newDontText}
                  onChange={(e) => setNewDontText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newDontText.trim()) {
                        setDonts((prev) => [...prev, newDontText.trim()]);
                        setNewDontText("");
                      }
                    }
                  }}
                  placeholder="Add a new Don't instruction..."
                  className="h-9 flex-1 rounded-xl border border-[#EED2D2] bg-white px-3 text-xs text-[#231917] focus:border-[#991B1B] focus:outline-none"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => {
                    if (!newDontText.trim()) return;
                    setDonts((prev) => [...prev, newDontText.trim()]);
                    setNewDontText("");
                  }}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <Textarea
            label="Closing Note & Booker Undertaking (Bottom of Page 2)"
            rows={2}
            value={footerNote}
            onChange={(e) => setFooterNote(e.target.value)}
            placeholder="Closing acknowledgement note printed above signatures..."
          />
        </CardBody>
        <CardFooter>
          <span className="text-xs text-[#7B6B63]">
            Updates apply to all new and existing booking printouts immediately.
          </span>
          <Button
            type="button"
            variant="primary"
            loading={savingGuidelines}
            leftIcon={<Save className="h-4 w-4" />}
            onClick={handleSaveGuidelines}
          >
            Save Do&apos;s &amp; Don&apos;ts
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
