"use client";

import React, { useRef, useState } from "react";
import {
  Copy,
  Plus,
  RotateCw,
  Save,
  Share2,
  Trash2,
} from "lucide-react";
import { cn } from "@sezsec/shared";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Select,
  Switch,
  notify,
} from "@sezsec/ui";
import type { FloorCanvasItem, FloorPlanRecord } from "./floor-plan.types";

const PRESET_ELEMENTS: Array<{
  label: string;
  shape: "circle" | "rectangle";
  widthFt: number;
  lengthFt: number;
  color: string;
}> = [
  { label: "Thaal (8 Guests)", shape: "circle", widthFt: 5.5, lengthFt: 5.5, color: "#6A1B1B" },
  { label: "Sarkari Thaal", shape: "circle", widthFt: 6, lengthFt: 6, color: "#B8924A" },
  { label: "Takht / Stage", shape: "rectangle", widthFt: 14, lengthFt: 8, color: "#4E1212" },
  { label: "Dining Table", shape: "rectangle", widthFt: 8, lengthFt: 3.5, color: "#5E4F4A" },
  { label: "Serving Counter", shape: "rectangle", widthFt: 10, lengthFt: 3, color: "#2A6041" },
  { label: "Chilamchi Station", shape: "rectangle", widthFt: 4, lengthFt: 4, color: "#8A6421" },
];

const PX_PER_FOOT = 10;

export function HallFloorPlanner({
  halls,
  initialPlans,
  canEdit = true,
}: {
  halls: Array<{ id: string; name: string; width: number | null; length: number | null }>;
  initialPlans: FloorPlanRecord[];
  canEdit?: boolean;
}) {
  const [plans, setPlans] = useState<FloorPlanRecord[]>(initialPlans);
  const [activePlanId, setActivePlanId] = useState<string>("");
  const [planName, setPlanName] = useState("Main Thaal Arrangement");
  const [selectedHallId, setSelectedHallId] = useState(halls[0]?.id || "");
  const selectedHall = halls.find((h) => h.id === selectedHallId);

  const [hallWidth, setHallWidth] = useState<number>(selectedHall?.width || 50);
  const [hallLength, setHallLength] = useState<number>(selectedHall?.length || 70);
  const [items, setItems] = useState<FloorCanvasItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState<number>(1);

  const pxPerFoot = PX_PER_FOOT * zoom;

  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{
    id: string;
    offsetXFt: number;
    offsetYFt: number;
  } | null>(null);

  const loadPlan = (plan: FloorPlanRecord) => {
    setActivePlanId(plan.id);
    setPlanName(plan.name);
    setSelectedHallId(plan.hallId);
    setHallWidth(plan.width);
    setHallLength(plan.length);
    setItems(plan.items);
    setIsPublic(plan.isPublic);
    setPublicToken(plan.publicToken);
    setSelectedItemId(null);
  };

  const addPreset = (preset: (typeof PRESET_ELEMENTS)[number]) => {
    if (!canEdit) return;
    const countSame = items.filter((i) => i.label.startsWith(preset.label.split(" ")[0])).length + 1;
    const newItem: FloorCanvasItem = {
      id: `fp-${crypto.randomUUID().slice(0, 8)}`,
      label: `${preset.label.split(" (")[0]} #${countSame}`,
      shape: preset.shape,
      widthFt: preset.widthFt,
      lengthFt: preset.lengthFt,
      xFt: Math.min(hallWidth - preset.widthFt, 4 + ((countSame * 6) % Math.max(10, hallWidth - 10))),
      yFt: Math.min(hallLength - preset.lengthFt, 4 + (Math.floor((countSame * 6) / Math.max(10, hallWidth - 10)) * 7)),
      rotation: 0,
      color: preset.color,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedItemId(newItem.id);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !canvasRef.current || !canEdit) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawXFt = (e.clientX - rect.left) / pxPerFoot - draggingRef.current.offsetXFt;
    const rawYFt = (e.clientY - rect.top) / pxPerFoot - draggingRef.current.offsetYFt;
    const snappedX = Math.round(rawXFt * 2) / 2;
    const snappedY = Math.round(rawYFt * 2) / 2;

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== draggingRef.current?.id) return item;
        const clampedX = Math.max(0, Math.min(hallWidth - item.widthFt, snappedX));
        const clampedY = Math.max(0, Math.min(hallLength - item.lengthFt, snappedY));
        return { ...item, xFt: clampedX, yFt: clampedY };
      })
    );
  };

  const handleSave = async () => {
    if (!selectedHallId) {
      notify.warning("Select a hall", "Please select a hall before saving.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/floor-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activePlanId || undefined,
          name: planName,
          hallId: selectedHallId,
          width: hallWidth,
          length: hallLength,
          items,
          isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not save layout", data.error || "Please try again.");
        return;
      }
      const saved: FloorPlanRecord = data.plan;
      setActivePlanId(saved.id);
      setPublicToken(saved.publicToken);
      setPlans((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
      });
      notify.success("Floor layout saved", `"${saved.name}" has been saved.`);
    } catch {
      notify.error("Network error", "Failed to save floor layout.");
    } finally {
      setSaving(false);
    }
  };

  const selectedItem = items.find((i) => i.id === selectedItemId) || null;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="space-y-5 xl:col-span-4">
        <Card accentTop>
          <CardHeader
            title="Layout Setup"
            subtitle="Choose a hall and arrange Thaals, stage, or tables to scale."
          />
          <CardBody className="space-y-4">
            {plans.length > 0 ? (
              <Select
                label="Load Saved Layout"
                value={activePlanId}
                placeholder="Start fresh or pick saved layout..."
                onChange={(val) => {
                  const found = plans.find((p) => p.id === val);
                  if (found) loadPlan(found);
                }}
                options={plans.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: `${p.hallName} (${p.items.length} items)`,
                }))}
              />
            ) : null}

            <Input
              label="Layout Name"
              value={planName}
              disabled={!canEdit}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="e.g. Walima 35 Thaals Setup"
            />

            <Select
              label="Hall"
              value={selectedHallId}
              disabled={!canEdit}
              onChange={(id) => {
                setSelectedHallId(id);
                const h = halls.find((x) => x.id === id);
                if (h?.width) setHallWidth(h.width);
                if (h?.length) setHallLength(h.length);
              }}
              options={halls.map((h) => ({
                value: h.id,
                label: h.name,
                sublabel:
                  h.width && h.length ? `${h.width} ft × ${h.length} ft` : undefined,
              }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Width (Feet)"
                type="number"
                disabled={!canEdit}
                value={String(hallWidth)}
                onChange={(e) => setHallWidth(Math.max(15, Number(e.target.value) || 40))}
              />
              <Input
                label="Length (Feet)"
                type="number"
                disabled={!canEdit}
                value={String(hallLength)}
                onChange={(e) => setHallLength(Math.max(15, Number(e.target.value) || 60))}
              />
            </div>

            {canEdit ? (
              <>
                <Switch
                  checked={isPublic}
                  onChange={setIsPublic}
                  label="Shareable View Link"
                  description="Allow booker or decorator to view this layout via link"
                />

                {isPublic && publicToken ? (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-[#D9C398] bg-[#FBF6EB] p-3 text-xs">
                    <span className="truncate font-medium text-[#6A1B1B]">
                      /public/floor-plan/{publicToken}
                    </span>
                    <Button
                      size="xs"
                      variant="secondary"
                      leftIcon={<Copy className="h-3.5 w-3.5" />}
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/public/floor-plan/${publicToken}`
                        );
                        notify.success("Link copied", "Shareable layout link copied.");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </CardBody>
          {canEdit ? (
            <CardFooter className="justify-end">
              <Button
                variant="primary"
                loading={saving}
                leftIcon={<Save className="h-4 w-4" />}
                onClick={handleSave}
              >
                Save Floor Layout
              </Button>
            </CardFooter>
          ) : null}
        </Card>

        {canEdit ? (
          <Card>
            <CardHeader
              title="Add Items to Hall"
              subtitle="Click to place, then drag on the floor grid"
            />
            <CardBody className="grid grid-cols-2 gap-2.5">
              {PRESET_ELEMENTS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => addPreset(preset)}
                  className="flex items-center gap-2 rounded-xl border border-[#E5DDD0] bg-[#FAF7F2] px-3 py-2.5 text-left text-xs font-medium text-[#231917] hover:border-[#B8924A] hover:bg-[#FBF6EB] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 shrink-0 text-[#6A1B1B]" />
                  <span className="truncate">{preset.label}</span>
                </button>
              ))}
            </CardBody>
          </Card>
        ) : null}

        {selectedItem && canEdit ? (
          <Card>
            <CardHeader title={`Selected: ${selectedItem.label}`} />
            <CardBody className="space-y-3">
              <Input
                label="Label"
                value={selectedItem.label}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((i) =>
                      i.id === selectedItem.id ? { ...i, label: e.target.value } : i
                    )
                  )
                }
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<RotateCw className="h-3.5 w-3.5" />}
                  onClick={() =>
                    setItems((prev) =>
                      prev.map((i) =>
                        i.id === selectedItem.id
                          ? { ...i, rotation: (i.rotation + 45) % 360 }
                          : i
                      )
                    )
                  }
                >
                  Rotate 45°
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setItems((prev) => prev.filter((i) => i.id !== selectedItem.id));
                    setSelectedItemId(null);
                  }}
                >
                  Remove
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <Card className="xl:col-span-8" accentTop>
        <CardHeader
          title={`${selectedHall?.name || "Hall"} Floor Grid (${hallWidth} ft × ${hallLength} ft)`}
          subtitle={`${items.length} items placed • 1 grid square = 5 feet`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              {isPublic && publicToken ? (
                <Badge tone="sage">
                  <Share2 className="h-3 w-3" /> Shared Link Ready
                </Badge>
              ) : null}
              <div className="inline-flex items-center gap-1 rounded-xl border border-[#DCD2C2] bg-[#FAF7F2] p-0.5 text-xs">
                {[
                  { label: "60%", value: 0.6 },
                  { label: "80%", value: 0.8 },
                  { label: "100%", value: 1 },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setZoom(opt.value)}
                    className={cn(
                      "rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
                      zoom === opt.value
                        ? "bg-[#6A1B1B] text-white"
                        : "text-[#5E4F4A] hover:bg-white"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          }
        />
        <CardBody className="overflow-auto bg-[#F6F2EA] p-4 sm:p-6">
          <div
            ref={canvasRef}
            onPointerMove={handlePointerMove}
            onPointerUp={() => {
              draggingRef.current = null;
            }}
            onPointerCancel={() => {
              draggingRef.current = null;
            }}
            style={{
              width: `${hallWidth * pxPerFoot}px`,
              height: `${hallLength * pxPerFoot}px`,
              backgroundSize: `${5 * pxPerFoot}px ${5 * pxPerFoot}px`,
              backgroundImage:
                "linear-gradient(to right, rgba(184,146,74,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(184,146,74,0.22) 1px, transparent 1px)",
            }}
            className="relative mx-auto rounded-lg border-2 border-[#6A1B1B] bg-white shadow-inner select-none touch-none"
          >
            {items.map((item) => {
              const active = item.id === selectedItemId;
              return (
                <div
                  key={item.id}
                  onPointerDown={(e) => {
                    setSelectedItemId(item.id);
                    if (!canEdit || !canvasRef.current) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const rect = canvasRef.current.getBoundingClientRect();
                    draggingRef.current = {
                      id: item.id,
                      offsetXFt: (e.clientX - rect.left) / pxPerFoot - item.xFt,
                      offsetYFt: (e.clientY - rect.top) / pxPerFoot - item.yFt,
                    };
                  }}
                  style={{
                    left: `${item.xFt * pxPerFoot}px`,
                    top: `${item.yFt * pxPerFoot}px`,
                    width: `${item.widthFt * pxPerFoot}px`,
                    height: `${item.lengthFt * pxPerFoot}px`,
                    backgroundColor: item.color,
                    transform: `rotate(${item.rotation}deg)`,
                  }}
                  className={cn(
                    "absolute flex items-center justify-center p-1 text-center text-[10px] font-semibold text-white shadow-sm transition-shadow touch-none",
                    item.shape === "circle" ? "rounded-full" : "rounded-md",
                    active ? "ring-2 ring-offset-2 ring-[#B8924A]" : "",
                    canEdit ? "cursor-grab active:cursor-grabbing" : ""
                  )}
                >
                  <span className="leading-tight drop-shadow-xs">{item.label}</span>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
