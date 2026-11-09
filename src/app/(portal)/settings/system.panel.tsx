"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Lock,
  Mail,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import type { DatabaseHealthReport } from "@sezsec/db/db.types";
import type { OfficeEmailSettingsSummary } from "@sezsec/settings";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  Modal,
  OtpInput,
  notify,
} from "@sezsec/ui";

export interface HealthPayload {
  database: DatabaseHealthReport;
  emailConfigured: boolean;
  senderEmail?: string;
  neonSourceConfigured: boolean;
}

export function SystemMaintenancePanel({
  userEmail,
  isAdmin,
  initialEmailSettings,
  initialHealth,
}: {
  userEmail: string | null;
  isAdmin: boolean;
  initialEmailSettings: OfficeEmailSettingsSummary;
  initialHealth: HealthPayload;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [health, setHealth] = useState<HealthPayload>(initialHealth);

  // Database-controlled outgoing email settings
  const [smtpEmail, setSmtpEmail] = useState(
    initialEmailSettings.smtpEmail || "info@sezsec.org"
  );
  const [smtpPassword, setSmtpPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [hasSavedPass, setHasSavedPass] = useState(
    initialEmailSettings.hasPassword
  );
  const [maskedPass, setMaskedPass] = useState(
    initialEmailSettings.maskedPassword
  );
  const [savingSmtp, setSavingSmtp] = useState(false);

  const [testEmail, setTestEmail] = useState(userEmail || "");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Verification code modal for clearing bookings
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [resetCode, setResetCode] = useState("");
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const refreshHealth = () => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setHealth(d))
      .catch(() => null);
  };

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpEmail.trim()) {
      notify.warning(
        "Sender email required",
        "Please enter the outgoing Jamaat office email address."
      );
      return;
    }
    if (!hasSavedPass && !smtpPassword.trim()) {
      notify.warning(
        "App password required",
        "Please enter the email app password to save."
      );
      return;
    }

    setSavingSmtp(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailSettings: {
            smtpEmail: smtpEmail.trim(),
            smtpPassword: smtpPassword.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error(
          "Could not save email settings",
          data.error || "Please check your details."
        );
        return;
      }

      setHasSavedPass(Boolean(data.emailSettings?.hasPassword));
      setMaskedPass(data.emailSettings?.maskedPassword || "");
      setSmtpPassword("");
      notify.success(
        "Email settings saved",
        `Verification & booking emails will be sent from ${data.emailSettings.smtpEmail}.`
      );
      refreshHealth();
      router.refresh();
    } catch {
      notify.error("Network error", "Could not save email settings.");
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) {
      notify.warning("Enter email", "Please enter an email address to test.");
      return;
    }
    setSendingEmail(true);
    try {
      const res = await fetch("/api/settings/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error(
          "Email test failed",
          data.error || "Please verify the sender email and app password above."
        );
        return;
      }
      notify.success("Test email sent!", `Delivered to ${testEmail.trim()}`);
    } catch {
      notify.error("Network error", "Could not send test email.");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleDownloadJsonBackup = () => {
    const a = document.createElement("a");
    a.href = "/api/settings/backup?format=json";
    a.download = "jamaat-portal-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    notify.info("Preparing backup file", "Your office backup download has started.");
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Restore failed", data.error || "Invalid backup file.");
        return;
      }
      notify.success(
        "Backup restored",
        "Halls, caterers, decorators, and store stock updated."
      );
      router.refresh();
    } catch {
      notify.error("Invalid file", "Please choose a valid office backup file.");
    } finally {
      setRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRequestResetOtp = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "SYSTEM_RESET" }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error(
          "Could not send code",
          data.error || "Add your email address in My Profile."
        );
        return;
      }
      setDevPreviewCode(data.devPreviewCode || null);
      setResetStep("verify");
      notify.info("Verification code sent", "Enter the 6-digit code to confirm.");
    } finally {
      setResetting(false);
    }
  };

  const handleConfirmReset = async () => {
    if (resetCode.length !== 6) {
      notify.warning("Enter 6 digits", "Please enter your 6-digit email code.");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/settings/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: resetCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not clear records", data.error || "Invalid code.");
        return;
      }
      notify.success(
        "Bookings cleared",
        "All bookings cleared and store counts reset."
      );
      setResetModalOpen(false);
      setResetStep("request");
      setResetCode("");
      router.refresh();
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Outgoing Email Sender Configuration (Database Controlled) */}
      {isAdmin ? (
        <form onSubmit={handleSaveEmailConfig}>
          <Card accentTop>
            <CardHeader
              title="Outgoing Verification & Booking Email Account"
              subtitle="Stored securely in the office database. Used to send 6-digit verification codes and hall booking confirmations."
              arabicRight="البريد الإلكتروني"
              action={
                <Badge tone={hasSavedPass ? "sage" : "amber"}>
                  {hasSavedPass ? `Active (${maskedPass})` : "Password Needed"}
                </Badge>
              }
            />
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Sender Email Address"
                type="email"
                required
                value={smtpEmail}
                onChange={(e) => setSmtpEmail(e.target.value)}
                placeholder="info@sezsec.org"
                leftAddon={<Mail className="h-4 w-4" />}
                hint="Official Jamaat email address shown to staff & bookers"
              />
              <Input
                label={
                  hasSavedPass
                    ? "Update App Password (Optional)"
                    : "Email App Password"
                }
                type={showPass ? "text" : "password"}
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={
                  hasSavedPass
                    ? `Saved (${maskedPass}) — enter new password to replace`
                    : "e.g. xxxx xxxx xxxx xxxx"
                }
                leftAddon={<Lock className="h-4 w-4" />}
                rightAddon={
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="rounded p-1 text-[#7B6B63] hover:text-[#231917] cursor-pointer"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                }
                hint="Google Workspace / Gmail 16-character App Password (encrypted in database)"
              />
            </CardBody>
            <CardFooter>
              <span className="text-xs text-[#6E5D55]">
                Changes take effect immediately across the entire portal without restarting.
              </span>
              <Button
                type="submit"
                variant="primary"
                loading={savingSmtp}
                leftIcon={<Save className="h-4 w-4" />}
              >
                Save Email Account
              </Button>
            </CardFooter>
          </Card>
        </form>
      ) : null}

      {/* System Status */}
      <Card accentTop={!isAdmin}>
        <CardHeader
          title="Portal Speed & System Health"
          subtitle="Live status of your office records storage and outgoing verification emails."
          action={
            <Badge
              tone={health?.database.status === "healthy" ? "sage" : "amber"}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {health?.database.status === "healthy"
                ? "Healthy & Ready"
                : "Checking"}
            </Badge>
          }
        />
        <CardBody>
          {health ? (
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              <div className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-3">
                <div className="text-[11px] text-[#7B6B63]">Multi-Staff Mode</div>
                <div className="mt-0.5 text-sm font-bold text-[#231917]">
                  Active &amp; Protected
                </div>
              </div>
              <div className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-3">
                <div className="text-[11px] text-[#7B6B63]">Response Speed</div>
                <div className="mt-0.5 text-sm font-bold text-[#23583A]">
                  {health.database.latencyMs} ms
                </div>
              </div>
              <div className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-3">
                <div className="text-[11px] text-[#7B6B63]">Records File Size</div>
                <div className="mt-0.5 text-sm font-bold text-[#231917]">
                  {(health.database.pragmas.databaseSizeBytes / 1024).toFixed(0)}{" "}
                  KB
                </div>
              </div>
              <div className="rounded-xl border border-[#EAE2D6] bg-[#FAF7F2] p-3">
                <div className="text-[11px] text-[#7B6B63]">Email Delivery</div>
                <div className="mt-0.5 truncate text-sm font-bold text-[#231917]">
                  {health.emailConfigured
                    ? health.senderEmail || "Ready"
                    : "Not Set Yet"}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#7B6B63]">Checking portal status...</p>
          )}
        </CardBody>
      </Card>

      {isAdmin ? (
        <>
          {/* Test Email */}
          <form onSubmit={handleSendTestEmail}>
            <Card>
              <CardHeader
                title="Send Test Verification Email"
                subtitle="Send a sample 6-digit verification email to confirm live delivery from your configured sender account."
              />
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Recipient Email Address"
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="staff@sezsec.org"
                    leftAddon={<Mail className="h-4 w-4" />}
                  />
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  loading={sendingEmail}
                  leftIcon={<Send className="h-4 w-4" />}
                >
                  Send Test Email
                </Button>
              </CardBody>
            </Card>
          </form>

          {/* Backup & Restore */}
          <Card>
            <CardHeader
              title="Offline Office Backup File"
              subtitle="Download a complete snapshot of halls, caterers, decorators, store stock, and bookings, or restore from a saved backup file."
            />
            <CardBody className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FBF6EB] text-[#6A1B1B]">
                  <HardDrive className="h-5 w-5" />
                </div>
                <div className="text-xs text-[#5E4F4A]">
                  <p className="text-sm font-semibold text-[#231917]">
                    Keep an Offline Copy Anytime
                  </p>
                  <p className="mt-0.5">
                    Booking charge figures are included in the backup file only
                    when unlocked with your 6-digit email code.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleRestoreFile}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  loading={restoring}
                  leftIcon={<Upload className="h-4 w-4" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Restore Backup File
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  leftIcon={<Download className="h-4 w-4" />}
                  onClick={handleDownloadJsonBackup}
                >
                  Download Backup File
                </Button>
              </div>
            </CardBody>
          </Card>

          {/* Protected Reset */}
          <Card className="border-[#EEC2C2]">
            <CardHeader
              title="Clear Bookings & Reset Store Available Counts"
              subtitle="Removes event bookings and activity logs while keeping your halls, caterers, decorators, team members, and store item list intact."
            />
            <CardFooter className="bg-[#FDF5F5]/70">
              <span className="text-xs text-[#991B1B]">
                Requires a 6-digit email verification code before anything is
                cleared.
              </span>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => {
                  setResetStep("request");
                  setResetCode("");
                  setResetModalOpen(true);
                }}
              >
                Clear Bookings...
              </Button>
            </CardFooter>
          </Card>

          <Modal
            open={resetModalOpen}
            onClose={() => setResetModalOpen(false)}
            title="Confirm Clearing Bookings"
            subtitle="Protected by 6-digit email verification."
            footer={
              resetStep === "request" ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setResetModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    loading={resetting}
                    leftIcon={<KeyRound className="h-4 w-4" />}
                    onClick={handleRequestResetOtp}
                  >
                    Send Verification Code
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setResetModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    loading={resetting}
                    onClick={handleConfirmReset}
                  >
                    Verify &amp; Clear Bookings
                  </Button>
                </>
              )
            }
          >
            {resetStep === "request" ? (
              <p className="text-sm text-[#4A3B36]">
                This will remove all hall bookings and activity history from
                this portal and reset every store item&apos;s available quantity
                back to its total stock. Team accounts, halls, caterers,
                decorators, and your online members database are{" "}
                <strong>not</strong> affected.
              </p>
            ) : (
              <div className="space-y-4">
                {devPreviewCode ? (
                  <div className="rounded-xl border border-[#D9C398] bg-[#FBF6EB] p-3 text-center text-xs text-[#6A1B1B]">
                    Verification Code:{" "}
                    <strong className="tracking-widest">{devPreviewCode}</strong>
                  </div>
                ) : null}
                <OtpInput
                  value={resetCode}
                  onChange={setResetCode}
                  disabled={resetting}
                />
              </div>
            )}
          </Modal>
        </>
      ) : null}
    </div>
  );
}
