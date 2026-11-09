"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import {
  Button,
  Input,
  KeelArchBanner,
  OtpInput,
  notify,
} from "@sezsec/ui";

export function ForgotPasswordClient() {
  const router = useRouter();
  const [step, setStep] = useState<"init" | "verify">("init");
  const [username, setUsername] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error(
          "Could not send code",
          data.error || "Please check username."
        );
        return;
      }
      setMaskedEmail(data.maskedEmail);
      setDevCode(data.devPreviewCode || null);
      setStep("verify");
      notify.success("Verification code sent", `Sent to ${data.maskedEmail}`);
    } catch {
      notify.error("Network error", "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error(
          "Could not update password",
          data.error || "Please check code."
        );
        return;
      }
      notify.success(
        "Password updated",
        "You can now sign in with your new password."
      );
      router.push("/login");
    } catch {
      notify.error("Network error", "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="jadwal-card jadwal-double-frame w-full max-w-md rounded-3xl bg-white p-6 sm:p-8">
        <KeelArchBanner
          arabicTitle="انجمن محمدي سکندرآباد"
          subtitle="Reset Your Portal Password"
        />

        {step === "init" ? (
          <form onSubmit={handleInit} className="mt-5 space-y-4">
            <p className="text-xs text-[#5E4F4A]">
              Enter your username and we will send a 6-digit code to your linked
              email address.
            </p>
            <Input
              label="Username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading}
              leftIcon={<Mail className="h-4 w-4" />}
            >
              Send 6-Digit Code
            </Button>
          </form>
        ) : (
          <form onSubmit={handleComplete} className="mt-5 space-y-4">
            <p className="text-center text-xs text-[#5E4F4A]">
              Enter the 6-digit code sent to <strong>{maskedEmail}</strong>
            </p>
            {devCode ? (
              <div className="rounded-xl border border-[#D9C398] bg-[#FBF6EB] p-2.5 text-center text-xs text-[#6A1B1B]">
                Local Test Code: <strong>{devCode}</strong>
              </div>
            ) : null}
            <OtpInput value={code} onChange={setCode} disabled={loading} />
            <Input
              label="New Password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading}
              leftIcon={<KeyRound className="h-4 w-4" />}
            >
              Save New Password
            </Button>
          </form>
        )}

        <div className="mt-5 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6A1B1B] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
