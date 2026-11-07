"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Phone, Plus, Sparkles, Trash2, Utensils } from "lucide-react";
import type { DirectoryContactItem, HallVenueItem } from "@sezsec/settings";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Input,
  notify,
} from "@sezsec/ui";

export function HallsDirectoryPanel({
  initialHalls,
}: {
  initialHalls: HallVenueItem[];
}) {
  const router = useRouter();
  const [halls, setHalls] = useState<HallVenueItem[]>(initialHalls);
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<HallVenueItem | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      notify.warning("Enter hall name", "Please enter the hall or venue name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          width: width ? Number(width) : null,
          length: length ? Number(length) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not save hall", data.error || "Please try again.");
        return;
      }
      setHalls((prev) => {
        const exists = prev.some((h) => h.id === data.hall.id);
        const next = exists
          ? prev.map((h) => (h.id === data.hall.id ? data.hall : h))
          : [...prev, data.hall];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setName("");
      setWidth("");
      setLength("");
      notify.success("Hall saved", `${data.hall.name} is ready for bookings.`);
      router.refresh();
    } catch {
      notify.error("Network error", "Could not save hall.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/settings/venues?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setHalls((prev) => prev.filter((h) => h.id !== deleteTarget.id));
        notify.success("Hall removed", `${deleteTarget.name} was removed.`);
        router.refresh();
      }
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card accentTop>
        <CardHeader
          title="Add or Update a Hall"
          subtitle="Room width and length (in feet) are used by the Hall Floor Planner."
          arabicRight="القاعات"
        />
        <CardBody>
          <form
            onSubmit={handleAdd}
            className="grid grid-cols-1 items-end gap-3.5 sm:grid-cols-4"
          >
            <div className="sm:col-span-2">
              <Input
                label="Hall / Venue Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Jamaat Khana Hall"
                leftAddon={<Building2 className="h-4 w-4" />}
              />
            </div>
            <Input
              label="Width (Feet)"
              type="number"
              min={10}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="e.g. 60"
            />
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label="Length (Feet)"
                  type="number"
                  min={10}
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  placeholder="e.g. 90"
                />
              </div>
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                leftIcon={<Plus className="h-4 w-4" />}
              >
                Save
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {halls.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No halls listed yet"
          description="Add your Jamaat halls above so staff can select them on booking forms."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {halls.map((hall) => (
            <Card key={hall.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-[#231917]">{hall.name}</h4>
                  <p className="mt-1 text-xs text-[#7B6B63]">
                    {hall.width && hall.length
                      ? `Dimensions: ${hall.width} ft × ${hall.length} ft`
                      : "Dimensions not set (uses default planner size)"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(hall)}
                  className="rounded-lg p-1.5 text-[#8C7B73] hover:bg-[#FEE2E2] hover:text-[#991B1B] cursor-pointer"
                  title="Remove hall"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={saving}
        danger
        title="Remove Hall from List?"
        message={`Remove "${deleteTarget?.name}" from selectable venues? Past bookings using this hall will not be affected.`}
        confirmLabel="Remove Hall"
      />
    </div>
  );
}

export function ContactDirectoryPanel({
  kind,
  initialItems,
}: {
  kind: "caterers" | "decorators";
  initialItems: DirectoryContactItem[];
}) {
  const router = useRouter();
  const isDecorator = kind === "decorators";
  const singular = isDecorator ? "Decorator" : "Caterer";
  const endpoint = isDecorator
    ? "/api/settings/decorators"
    : "/api/settings/caterers";

  const [items, setItems] = useState<DirectoryContactItem[]>(initialItems);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<DirectoryContactItem | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      notify.warning(
        `Enter ${singular.toLowerCase()} details`,
        "Both name and mobile number are required."
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error(`Could not save ${singular.toLowerCase()}`, data.error);
        return;
      }
      const saved: DirectoryContactItem = isDecorator
        ? data.decorator
        : data.caterer;
      setItems((prev) => {
        const exists = prev.some((i) => i.id === saved.id);
        const next = exists
          ? prev.map((i) => (i.id === saved.id ? saved : i))
          : [...prev, saved];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      setName("");
      setPhone("");
      notify.success(`${singular} saved`, `${saved.name} added to quick pick list.`);
      router.refresh();
    } catch {
      notify.error("Network error", `Could not save ${singular.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${endpoint}?id=${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
        notify.success(`${singular} removed`, `${deleteTarget.name} was removed.`);
        router.refresh();
      }
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card accentTop>
        <CardHeader
          title={`Saved ${singular}s List`}
          subtitle={
            isDecorator
              ? "Whenever Decorations is selected for a Jamaat hall booking, staff can pick a saved decorator in one click."
              : "Quick-select list of regular caterers and mobile numbers when creating hall bookings."
          }
          action={<Badge tone="brass">{items.length} Saved</Badge>}
        />
        <CardBody>
          <form
            onSubmit={handleSave}
            className="grid grid-cols-1 items-end gap-3.5 sm:grid-cols-3"
          >
            <Input
              label={`${singular} Name`}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                isDecorator ? "e.g. Burhani Decorators" : "e.g. Saifee Caterers"
              }
              leftAddon={
                isDecorator ? (
                  <Sparkles className="h-4 w-4" />
                ) : (
                  <Utensils className="h-4 w-4" />
                )
              }
            />
            <Input
              label="Mobile Number"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit phone number"
              leftAddon={<Phone className="h-4 w-4" />}
            />
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add {singular}
            </Button>
          </form>
        </CardBody>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          icon={
            isDecorator ? (
              <Sparkles className="h-6 w-6" />
            ) : (
              <Utensils className="h-6 w-6" />
            )
          }
          title={`No saved ${singular.toLowerCase()}s yet`}
          description={`Add frequent ${singular.toLowerCase()}s above. Any new ${singular.toLowerCase()} typed on a booking form is also saved here automatically.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-[#231917]">{item.name}</h4>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[#6E5D55]">
                    <Phone className="h-3.5 w-3.5 text-[#8A6421]" />
                    {item.phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  className="rounded-lg p-1.5 text-[#8C7B73] hover:bg-[#FEE2E2] hover:text-[#991B1B] cursor-pointer"
                  title={`Remove ${singular.toLowerCase()}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={saving}
        danger
        title={`Remove ${singular}?`}
        message={`Remove "${deleteTarget?.name}" from the quick-pick list? Existing bookings will keep their saved contact details.`}
        confirmLabel={`Remove ${singular}`}
      />
    </div>
  );
}
