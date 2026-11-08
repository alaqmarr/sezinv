"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Mail, Phone, Save, ShieldCheck, User } from "lucide-react";
import { ROLE_LABELS } from "@sezsec/shared";
import type { SessionUser } from "@sezsec/auth/auth.types";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
  OtpInput,
  notify,
} from "@sezsec/ui";

export function ProfileEditorClient({
  initialUser,
  onboardingMode = false,
}: {
  initialUser: SessionUser;
  onboardingMode?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialUser.name || "");
  const [email, setEmail] = useState(initialUser.email || "");
  const [mobile, setMobile] = useState(initialUser.mobile || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change via 6-digit email code
  const [otpStep, setOtpStep] = useState<"idle" | "verify">("idle");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [devPreviewCode, setDevPreviewCode] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      notify.warning("Enter your name", "Please enter your full name.");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, mobile }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not save details", data.error || "Please try again.");
        return;
      }
      notify.success("Profile saved", "Your contact details have been updated.");
      if (onboardingMode) {
        router.push("/");
      }
      router.refresh();
    } catch {
      notify.error("Network error", "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSkipOnboarding = async () => {
    setSavingProfile(true);
    try {
      await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip: true }),
      });
      router.push("/");
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRequestPasswordCode = async () => {
    if (!email.trim()) {
      notify.warning(
        "Email address needed",
        "Please save your email address above first so we can send your 6-digit code."
      );
      return;
    }
    setChangingPass(true);
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "PROFILE_PASSWORD" }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not send code", data.error || "Please save your email first.");
        return;
      }
      setMaskedEmail(data.maskedEmail || email);
      setDevPreviewCode(data.devPreviewCode || null);
      setOtpStep("verify");
      if (data.emailSent) {
        notify.success("Verification code sent", `Sent to ${data.maskedEmail}`);
      } else {
        notify.info("Verification code ready", "Shown below because outgoing email is not set up yet.");
      }
    } catch {
      notify.error("Network error", "Could not request verification code.");
    } finally {
      setChangingPass(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      notify.warning("Enter 6-digit code", "Please enter the verification code.");
      return;
    }
    if (newPassword.length < 6) {
      notify.warning("Short password", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.warning("Passwords do not match", "Please make sure both passwords match.");
      return;
    }

    setChangingPass(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error("Could not change password", data.error || "Please check your code.");
        return;
      }
      notify.success("Password updated", "Your new password is now active.");
      setOtpStep("idle");
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
      setDevPreviewCode(null);
    } catch {
      notify.error("Network error", "Could not update password.");
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSaveProfile}>
        <Card accentTop>
          <CardHeader
            title="Your Name & Contact Details"
            subtitle={
              initialUser.canViewCharges
                ? "Your email address is used to send 6-digit codes when viewing booking charges or changing your password."
                : "Your email address is used to send 6-digit verification codes when changing or resetting your password."
            }
            action={
              <Badge tone="maroon">
                {ROLE_LABELS[initialUser.role] || initialUser.role}
              </Badge>
            }
          />
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Sign-In Username / ITS ID"
              value={initialUser.username}
              disabled
              hint="Used to sign in to the portal"
            />
            <Input
              label="Full Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Murtaza Bhai"
              leftAddon={<User className="h-4 w-4" />}
            />
            <Input
              label="Email Address (For 6-Digit Codes)"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              leftAddon={<Mail className="h-4 w-4" />}
              hint={
                initialUser.canViewCharges
                  ? "Required to unlock rupee charges and verify password updates"
                  : "Used to receive 6-digit codes for password updates"
              }
            />
            <Input
              label="Mobile Number"
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="10-digit mobile number"
              leftAddon={<Phone className="h-4 w-4" />}
            />
          </CardBody>
          <CardFooter>
            {onboardingMode ? (
              <Button
                type="button"
                variant="ghost"
                disabled={savingProfile}
                onClick={handleSkipOnboarding}
              >
                Skip for Now
              </Button>
            ) : (
              <span className="text-xs text-[#7B6B63]">
                Keep your email up to date for instant 6-digit verification codes.
              </span>
            )}
            <Button
              type="submit"
              variant="primary"
              loading={savingProfile}
              leftIcon={<Save className="h-4 w-4" />}
            >
              {onboardingMode ? "Save & Continue to Portal" : "Save My Details"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {!onboardingMode ? (
        <Card>
          <CardHeader
            title="Change Password"
            subtitle="Protected by a 6-digit email verification code."
            arabicRight="تغيير كلمة المرور"
          />
          <CardBody>
            {otpStep === "idle" ? (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FBF6EB] text-[#6A1B1B]">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="text-sm text-[#4A3B36]">
                    <p className="font-medium text-[#231917]">
                      Verify by Email to Set a New Password
                    </p>
                    <p className="mt-0.5 text-xs text-[#7B6B63]">
                      We will send a 6-digit code to{" "}
                      <strong>{initialUser.email || "your saved email"}</strong>.
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  loading={changingPass}
                  leftIcon={<KeyRound className="h-4 w-4" />}
                  onClick={handleRequestPasswordCode}
                >
                  Send Email Code
                </Button>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="rounded-xl border border-[#D9C398] bg-[#FBF6EB] p-3.5 text-xs text-[#6A1B1B]">
                  Enter the 6-digit code sent to <strong>{maskedEmail}</strong>.
                  {devPreviewCode ? (
                    <span className="ml-2">
                      Local Test Code:{" "}
                      <strong className="tracking-widest">{devPreviewCode}</strong>
                    </span>
                  ) : null}
                </div>

                <OtpInput
                  value={otpCode}
                  onChange={setOtpCode}
                  disabled={changingPass}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="New Password"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                  />
                  <Input
                    label="Confirm New Password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={changingPass}
                    onClick={() => {
                      setOtpStep("idle");
                      setOtpCode("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={changingPass}
                    leftIcon={<Check className="h-4 w-4" />}
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
