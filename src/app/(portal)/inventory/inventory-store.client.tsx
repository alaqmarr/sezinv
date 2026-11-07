"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3,
  PackagePlus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { StoreItem } from "@sezsec/inventory";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  NumericStepper,
  PageHeader,
  PaginationBar,
  Select,
  Tabs,
  notify,
} from "@sezsec/ui";

const COMMON_CATEGORIES = [
  "Thaals & Covers",
  "Cooking Vessels (Deg / Tapela)",
  "Serving Bowls & Spoons",
  "Chilamchi & Lota",
  "Furniture & Carpets",
  "Electrical & Gas",
  "General",
];

export function InventoryStoreClient({
  items,
  canManage,
  canDelete,
}: {
  items: StoreItem[];
  canManage: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [categoryTab, setCategoryTab] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StoreItem | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Thaals & Covers");
  const [totalQuantity, setTotalQuantity] = useState(10);
  const [unit, setUnit] = useState("pcs");
  const [saving, setSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<StoreItem | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) set.add(i.category);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryTab !== "ALL" && i.category !== categoryTab) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    });
  }, [items, categoryTab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const openCreateModal = () => {
    setEditingItem(null);
    setName("");
    setCategory("Thaals & Covers");
    setTotalQuantity(10);
    setUnit("pcs");
    setEditorOpen(true);
  };

  const openEditModal = (item: StoreItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setTotalQuantity(item.totalQuantity);
    setUnit(item.unit);
    setEditorOpen(true);
  };

  const handleSaveItem = async () => {
    if (!name.trim()) {
      notify.warning("Enter item name", "Please enter a name for the vessel or item.");
      return;
    }
    setSaving(true);
    try {
      const url = editingItem
        ? `/api/inventory/${encodeURIComponent(editingItem.id)}`
        : "/api/inventory";
      const method = editingItem ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, totalQuantity, unit }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not save item", data.error || "Please try again.");
        return;
      }
      notify.success(
        editingItem ? "Item updated" : "Item added",
        `"${name}" saved in store catalog.`
      );
      setEditorOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      notify.warning("Paste items first", "Enter one item per line: Name, Category, Qty, Unit");
      return;
    }
    const parsed = lines.map((line) => {
      const [itemName, cat, qtyStr, unitStr] = line.split(",").map((s) => s.trim());
      return {
        name: itemName || "",
        category: cat || "General",
        totalQuantity: Number(qtyStr) || 0,
        unit: unitStr || "pcs",
      };
    });

    setSaving(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Import failed", data.error || "Please check format.");
        return;
      }
      notify.success("Items imported", `Added ${data.count} items to store.`);
      setBulkText("");
      setBulkOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/inventory/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        notify.error("Cannot delete item", data.error || "Item is in use.");
        return;
      }
      notify.success("Item removed", `"${deleteTarget.name}" removed.`);
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vessel & Crockery Store"
        subtitle="Master stock list of Jamaat Thaals, cooking vessels, Chilamchi-Lota, and hall equipment"
        arabicBadge="مخزن الأواني"
        actions={
          canManage ? (
            <>
              <Button
                variant="secondary"
                leftIcon={<Upload className="h-4 w-4" />}
                onClick={() => setBulkOpen(true)}
              >
                Add Multiple Items
              </Button>
              <Button
                variant="primary"
                leftIcon={<PackagePlus className="h-4 w-4" />}
                onClick={openCreateModal}
              >
                Add Store Item
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          activeId={categoryTab}
          onChange={(nextTab) => {
            setCategoryTab(nextTab);
            setPage(1);
          }}
          tabs={[
            { id: "ALL", label: "All Categories", count: items.length },
            ...categories.map((c) => ({
              id: c,
              label: c,
              count: items.filter((it) => it.category === c).length,
            })),
          ]}
        />
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search item name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            leftAddon={<Search className="h-4 w-4" />}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No store items found"
          description="Add Thaals, Tapelas, Chilamchi-Lota, or crockery items to start tracking stock."
          action={
            canManage ? (
              <Button variant="primary" onClick={openCreateModal}>
                Add First Store Item
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card accentTop className="overflow-hidden">
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F3EFE6] text-xs font-semibold uppercase text-[#5E4F4A]">
                <tr>
                  <th className="px-4 py-3.5">Item Name</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5 text-right">Total Owned</th>
                  <th className="px-4 py-3.5 text-right">In Store Right Now</th>
                  <th className="px-4 py-3.5 text-right">Out on Bookings</th>
                  {canManage ? (
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE2D6]">
                {paginatedItems.map((item) => {
                  const outCount = Math.max(
                    0,
                    item.totalQuantity - item.availableQuantity
                  );
                  return (
                    <tr key={item.id} className="hover:bg-[#FAF7F2]/80">
                      <td className="px-4 py-3.5 font-semibold text-[#231917]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge tone="neutral">{item.category}</Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {item.totalQuantity} {item.unit}
                      </td>
                      <td className="px-4 py-3.5 text-right font-bold text-[#2A6041]">
                        {item.availableQuantity} {item.unit}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {outCount > 0 ? (
                          <Badge tone="amber">
                            {outCount} {item.unit} out
                          </Badge>
                        ) : (
                          <span className="text-xs text-[#8C7B73]">0</span>
                        )}
                      </td>
                      {canManage ? (
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              size="xs"
                              variant="secondary"
                              leftIcon={<Edit3 className="h-3 w-3" />}
                              onClick={() => openEditModal(item)}
                            >
                              Edit
                            </Button>
                            {canDelete ? (
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setDeleteTarget(item)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-[#991B1B]" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
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
            itemLabel="store items"
          />
        </Card>
      )}

      {/* Add / Edit Item Modal */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingItem ? `Edit Item: ${editingItem.name}` : "Add New Store Item"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSaveItem}>
              Save Item
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Item Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Steel Thaal Large"
          />
          <Select
            label="Category"
            value={category}
            onChange={setCategory}
            options={Array.from(new Set([...COMMON_CATEGORIES, ...categories])).map(
              (c) => ({ value: c, label: c })
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumericStepper
              label="Total Stock Owned"
              value={totalQuantity}
              onChange={setTotalQuantity}
            />
            <Select
              label="Counting Unit"
              value={unit}
              onChange={setUnit}
              options={[
                { value: "pcs", label: "Pieces (pcs)" },
                { value: "sets", label: "Sets" },
                { value: "doz", label: "Dozens" },
                { value: "nos", label: "Numbers" },
              ]}
            />
          </div>
        </div>
      </Modal>

      {/* Bulk Paste Modal */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Add Multiple Store Items at Once"
        subtitle="Enter one item per line: Item Name, Category, Total Quantity, Unit"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleBulkImport}>
              Import All Items
            </Button>
          </>
        }
      >
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"Steel Thaal Large, Thaals & Covers, 120, pcs\nCopper Chilamchi Lota, Chilamchi & Lota, 40, sets"}
          className="h-44 w-full rounded-xl border border-[#DCD2C2] p-3 text-xs font-mono focus:border-[#6A1B1B] focus:outline-none"
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteItem}
        danger
        loading={saving}
        title="Remove Store Item?"
        confirmLabel="Remove Item"
        message={`Remove "${deleteTarget?.name}" from the store catalog? Items that have already been issued to bookings are protected from deletion.`}
      />
    </div>
  );
}
