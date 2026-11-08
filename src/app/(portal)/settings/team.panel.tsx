"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3,
  IndianRupee,
  Lock,
  Mail,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { ROLE_LABELS, type AppRole } from "@sezsec/shared";
import {
  DEFAULT_PORTAL_MODULES,
  DEFAULT_STAFF_MODULE_IDS,
  EVENT_CHARGES_MODULE_ID,
} from "@sezsec/rbac/rbac.constants";
import { hasEventChargesModule } from "@sezsec/rbac/rbac.helper";
import type { TeamMemberRecord } from "@sezsec/users";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  MultiSelectPills,
  Select,
  Switch,
  notify,
} from "@sezsec/ui";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Administrator (Full Office & Migration Control)" },
  { value: "MANAGER", label: "Office Manager (Bookings, Vessels & Settings)" },
  { value: "STAFF", label: "Store & Hall Staff (Issue/Return Vessels & View)" },
  { value: "WATCHER", label: "View-Only Member (Read Bookings & Print)" },
  { value: "ADMIN_CUSTOM", label: "Committee Lead (Bookings & Settings)" },
];

const SECTION_MODULES = DEFAULT_PORTAL_MODULES.filter(
  (m) => m.id !== EVENT_CHARGES_MODULE_ID
);
const PORTAL_MODULE_ID_SET = new Set<string>(
  DEFAULT_PORTAL_MODULES.map((m) => m.id)
);

export function TeamManagementPanel({
  initialMembers,
  currentUserId,
}: {
  initialMembers: TeamMemberRecord[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<TeamMemberRecord[]>(initialMembers);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMemberRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMemberRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [its, setIts] = useState("");
  const [role, setRole] = useState<AppRole>("STAFF");
  const [password, setPassword] = useState("");
  const [sectionModuleIds, setSectionModuleIds] = useState<string[]>([
    ...DEFAULT_STAFF_MODULE_IDS,
  ]);
  const [chargesEnabled, setChargesEnabled] = useState(false);
  const [extraModuleIds, setExtraModuleIds] = useState<string[]>([]);

  const openCreateModal = () => {
    setEditing(null);
    setUsername("");
    setName("");
    setEmail("");
    setMobile("");
    setIts("");
    setRole("STAFF");
    setPassword("");
    setSectionModuleIds([...DEFAULT_STAFF_MODULE_IDS]);
    setChargesEnabled(false);
    setExtraModuleIds([]);
    setModalOpen(true);
  };

  const openEditModal = (m: TeamMemberRecord) => {
    setEditing(m);
    setUsername(m.username);
    setName(m.name || "");
    setEmail(m.email || "");
    setMobile(m.mobile || "");
    setIts(m.its || "");
    setRole(m.role);
    setPassword("");

    const existingSections = m.moduleIds.filter(
      (id) => PORTAL_MODULE_ID_SET.has(id) && id !== EVENT_CHARGES_MODULE_ID
    );
    setSectionModuleIds(
      existingSections.length > 0
        ? existingSections
        : [...DEFAULT_STAFF_MODULE_IDS]
    );
    setChargesEnabled(hasEventChargesModule(m.role, m.moduleIds));
    setExtraModuleIds(
      m.moduleIds.filter(
        (id) => !PORTAL_MODULE_ID_SET.has(id) && id !== "event-charges"
      )
    );
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing && (!username.trim() || password.length < 6)) {
      notify.warning(
        "Required fields",
        "Please enter a username and a password of at least 6 characters."
      );
      return;
    }

    const allowCharges = role === "ADMIN" || chargesEnabled;
    const moduleIds = Array.from(
      new Set([
        ...sectionModuleIds,
        ...(allowCharges ? [EVENT_CHARGES_MODULE_ID] : []),
        ...extraModuleIds,
      ])
    );

    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/users/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            mobile,
            its,
            role,
            newPassword: password.trim() || undefined,
            moduleIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          notify.error("Could not update member", data.error || "Try again.");
          return;
        }
        setMembers((prev) =>
          prev.map((m) =>
            m.id === editing.id
              ? {
                  ...m,
                  name: name.trim() || null,
                  email: email.trim().toLowerCase() || null,
                  mobile: mobile.trim() || null,
                  its: its.trim() || null,
                  role,
                  moduleIds,
                }
              : m
          )
        );
        notify.success("Team member updated", `${name || editing.username} saved.`);
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            password,
            name,
            email,
            mobile,
            its,
            role,
            moduleIds,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          notify.error("Could not add member", data.error || "Try again.");
          return;
        }
        setMembers((prev) => [...prev, data.user]);
        notify.success("Team member added", `${data.user.name || data.user.username} can now sign in.`);
      }
      setModalOpen(false);
      router.refresh();
    } catch {
      notify.error("Network error", "Could not save team member.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not remove member", data.error || "Try again.");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      notify.success("Account removed", `${deleteTarget.name || deleteTarget.username} removed.`);
      router.refresh();
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#231917]">
            Office Staff &amp; Committee Accounts ({members.length})
          </h3>
          <p className="text-xs text-[#7B6B63]">
            Only accounts with the <strong>Event Charges</strong> module enabled (or Administrators) can unlock rupee charges via 6-digit email code.
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<UserPlus className="h-4 w-4" />}
          onClick={openCreateModal}
        >
          Add Team Member
        </Button>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No team members found"
          description="Add accounts for your office manager and store staff."
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#EAE2D6] bg-[#FAF7F2] text-xs font-semibold uppercase tracking-wider text-[#7B6B63]">
                  <th className="px-5 py-3.5">Name &amp; Sign-In ID</th>
                  <th className="px-5 py-3.5">Access Level</th>
                  <th className="px-5 py-3.5">Charges Access</th>
                  <th className="px-5 py-3.5">Email (For 6-Digit Codes)</th>
                  <th className="px-5 py-3.5">Mobile</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0E9DD]">
                {members.map((m) => {
                  const memberHasCharges = hasEventChargesModule(
                    m.role,
                    m.moduleIds
                  );
                  return (
                  <tr key={m.id} className="hover:bg-[#FAF7F2]/60">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-[#231917]">
                        {m.name || m.username}
                        {m.id === currentUserId ? (
                          <span className="ml-2 text-xs font-normal text-[#6A1B1B]">
                            (You)
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-[#7B6B63]">
                        Username: <code>{m.username}</code>
                        {m.its ? ` • ITS: ${m.its}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <Badge
                        tone={
                          m.role === "ADMIN"
                            ? "maroon"
                            : m.role === "MANAGER" || m.role === "ADMIN_CUSTOM"
                              ? "brass"
                              : "neutral"
                        }
                      >
                        {ROLE_LABELS[m.role] || m.role}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      {m.role === "ADMIN" ? (
                        <Badge tone="maroon">
                          <IndianRupee className="mr-1 h-3 w-3" />
                          Allowed (Admin)
                        </Badge>
                      ) : memberHasCharges ? (
                        <Badge tone="sage">
                          <IndianRupee className="mr-1 h-3 w-3" />
                          Event Charges
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[#8C7B73]">
                          <Lock className="h-3 w-3" />
                          Restricted
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {m.email ? (
                        <span className="inline-flex items-center gap-1.5 text-[#23583A]">
                          <Mail className="h-3.5 w-3.5" />
                          {m.email}
                        </span>
                      ) : memberHasCharges ? (
                        <span className="font-medium text-[#925708]">
                          Needed for 6-digit codes
                        </span>
                      ) : (
                        <span className="text-[#8C7B73]">Not added</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-xs text-[#5E4F4A]">
                      {m.mobile || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Edit3 className="h-3.5 w-3.5" />}
                          onClick={() => openEditModal(m)}
                        >
                          Edit
                        </Button>
                        {m.id !== currentUserId ? (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(m)}
                            className="rounded-lg p-2 text-[#8C7B73] hover:bg-[#FEE2E2] hover:text-[#991B1B] cursor-pointer"
                            title="Remove account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Team Member" : "Add New Team Member"}
        subtitle="Configure sign-in details, role permissions, and email for 6-digit codes."
        maxWidth="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={handleSave}
            >
              {editing ? "Save Changes" : "Create Account"}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Sign-In Username / ITS"
            required
            disabled={Boolean(editing)}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. 30405060 or office_staff"
          />
          <Input
            label="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Shabbir Bhai"
          />
          <Input
            label="Email Address (For 6-Digit Codes)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="staff@example.com"
          />
          <Input
            label="Mobile Number"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="10-digit mobile number"
          />
          <Select
            label="Role & Permission Level"
            value={role}
            onChange={(v) => {
              const nextRole = v as AppRole;
              setRole(nextRole);
              if (nextRole === "ADMIN") {
                setChargesEnabled(true);
              }
            }}
            options={ROLE_OPTIONS}
          />
          <Input
            label={
              editing
                ? "Reset Password (Optional)"
                : "Initial Password"
            }
            type="password"
            required={!editing}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={
              editing
                ? "Leave blank to keep current password"
                : "Minimum 6 characters"
            }
          />
          <div className="sm:col-span-2">
            <MultiSelectPills
              label="Portal Sections Enabled"
              options={SECTION_MODULES.map((m) => ({
                value: m.id,
                label: m.name,
              }))}
              values={sectionModuleIds}
              onChange={setSectionModuleIds}
            />
          </div>
          <div className="sm:col-span-2 rounded-2xl border border-[#D9C398] bg-[#FBF6EB]/75 p-4">
            <Switch
              checked={role === "ADMIN" || chargesEnabled}
              disabled={role === "ADMIN"}
              onChange={setChargesEnabled}
              label="Event Charges Access (Unlock Amounts via 6-Digit Email Code)"
              description={
                role === "ADMIN"
                  ? "Included automatically for Administrators."
                  : "When enabled, this member receives the Event Charges module and can unlock, view, and print booking rupee charges using a 6-digit email code."
              }
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={saving}
        danger
        title="Remove Team Member?"
        message={`Remove "${deleteTarget?.name || deleteTarget?.username}"? Past bookings recorded by them will remain safe in your database.`}
        confirmLabel="Remove Account"
      />
    </div>
  );
}
