"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Lock, Mail } from "lucide-react";
import { Button, Modal, OtpInput, notify } from "@sezsec/ui";

export function AmountUnlockModal({
  open,
  onClose,
  onUnlocked,
}: {
  open: boolean;
  onClose: () => void;
  onUnlocked?: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [maskedEmail, setMaskedEmail] = useState<string>("");
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/finance/otp/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not send code", data.error || "Please check your profile email.");
        return;
      }
      setMaskedEmail(data.maskedEmail || "your email");
      setDevPreviewCode(data.devPreviewCode || null);
      setStep("verify");
      if (data.emailSent) {
        notify.success("Verification code sent", `Sent to ${data.maskedEmail}`);
      } else {
        notify.info(
          "Email password not set yet",
          "Showing local verification code below so you can test right away."
        );
      }
    } catch {
      notify.error("Network error", "Could not request verification code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      notify.warning("Enter 6 digits", "Please enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/finance/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Invalid code", data.error || "Please try again.");
        return;
      }
      notify.success("Charges visible", "Booking amounts are now visible for 20 minutes.");
      setCode("");
      setStep("request");
      onClose();
      router.refresh();
      onUnlocked?.();
    } catch {
      notify.error("Network error", "Could not verify code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setStep("request");
        setCode("");
        onClose();
      }}
      title="Verify Email to View Charges"
      subtitle="Booking amounts are kept private until verified with your email code."
      footer={
        step === "request" ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              leftIcon={<Mail className="h-4 w-4" />}
              loading={loading}
              onClick={handleSendCode}
            >
              Send 6-Digit Code
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setCode("");
                handleSendCode();
              }}
              disabled={loading}
            >
              Resend Code
            </Button>
            <Button
              variant="primary"
              leftIcon={<KeyRound className="h-4 w-4" />}
              loading={loading}
              onClick={handleVerifyCode}
            >
              Show Charges
            </Button>
          </>
        )
      }
    >
      {step === "request" ? (
        <div className="space-y-3 text-sm text-[#4A3B36]">
          <p>
            For privacy, all rupee amounts and deposits stay hidden on screen and on
            printed sheets until you confirm a 6-digit code sent to your email address.
          </p>
          <div className="rounded-xl border border-[#D9C398] bg-[#FBF6EB] p-3.5 text-xs text-[#6A1B1B]">
            Once verified, amounts remain visible to you for <strong>20 minutes</strong>,
            and you can hide them again anytime with one click.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-center text-sm text-[#4A3B36]">
            Enter the 6-digit code sent to <strong>{maskedEmail}</strong>
          </p>
          {devPreviewCode ? (
            <div className="rounded-xl border border-[#D9C398] bg-[#FBF6EB] px-3.5 py-2.5 text-center text-xs text-[#6A1B1B]">
              Verification Code (outgoing office email not configured yet):{" "}
              <strong className="ml-1 tracking-widest text-sm">{devPreviewCode}</strong>
            </div>
          ) : null}
          <OtpInput value={code} onChange={setCode} disabled={loading} />
        </div>
      )}
    </Modal>
  );
}

export function AmountAccessBar({
  unlocked,
  onUnlocked,
  compact = false,
}: {
  unlocked: boolean;
  onUnlocked?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [locking, setLocking] = useState(false);

  const handleLockNow = async () => {
    setLocking(true);
    try {
      await fetch("/api/finance/lock", { method: "POST" });
      notify.info("Charges hidden", "All rupee amounts are hidden again.");
      router.refresh();
      onUnlocked?.();
    } finally {
      setLocking(false);
    }
  };

  if (compact) {
    return (
      <>
        {unlocked ? (
          <Button
            variant="secondary"
            size="sm"
            loading={locking}
            leftIcon={<EyeOff className="h-3.5 w-3.5" />}
            onClick={handleLockNow}
          >
            Hide Charges
          </Button>
        ) : (
          <Button
            variant="brass"
            size="sm"
            leftIcon={<Lock className="h-3.5 w-3.5" />}
            onClick={() => setModalOpen(true)}
          >
            Show Charges (Email Code)
          </Button>
        )}
        <AmountUnlockModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onUnlocked={onUnlocked}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#D9C398] bg-[#FBF6EB]/85 px-4 py-3">
        <div className="flex items-center gap-2.5 text-xs sm:text-sm">
          {unlocked ? (
            <>
              <Eye className="h-4 w-4 shrink-0 text-[#2A6041]" />
              <span className="font-medium text-[#23583A]">
                Charges are currently visible (verified by Email Code).
              </span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 shrink-0 text-[#6A1B1B]" />
              <span className="text-[#4A3B36]">
                Charges &amp; deposit amounts are hidden. Verify with a 6-digit email
                code to view, edit, or print them.
              </span>
            </>
          )}
        </div>
        {unlocked ? (
          <Button
            variant="secondary"
            size="sm"
            loading={locking}
            leftIcon={<EyeOff className="h-3.5 w-3.5" />}
            onClick={handleLockNow}
          >
            Hide Charges
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<KeyRound className="h-3.5 w-3.5" />}
            onClick={() => setModalOpen(true)}
          >
            Show Charges (Email Code)
          </Button>
        )}
      </div>

      <AmountUnlockModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUnlocked={onUnlocked}
      />
    </>
  );
}
