"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, DatabaseBackup, LogIn, RefreshCw } from "lucide-react";
import {
  ArabesqueDivider,
  Button,
  KeelArchBanner,
  notify,
} from "@sezsec/ui";

export function SyncSetupClient() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [doneResult, setDoneResult] = useState<{
    totalImported: number;
    usersSynced: number;
  } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/setup/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify.error(
          "Sync could not finish",
          data.error || "Please check your connection and try again."
        );
        return;
      }

      const summary = {
        totalImported: Number(data.totalImported ?? 0),
        usersSynced: Number(data.usersSynced ?? 0),
      };
      setDoneResult(summary);

      notify.success(
        "Records synced successfully",
        `Copied ${summary.totalImported.toLocaleString("en-IN")} records (${summary.usersSynced} accounts).`
      );
    } catch {
      notify.error("Network error", "Could not connect to server.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="jadwal-card jadwal-double-frame w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8">
        <KeelArchBanner
          arabicTitle="بسم الله الرحمن الرحيم"
          subtitle="Sync Accounts & Records from Previous Database"
        />

        <div className="mt-5 rounded-2xl border border-[#E6DAC3] bg-[#FBF6EB] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D9C398] bg-white text-[#6A1B1B]">
              <DatabaseBackup className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 text-xs leading-relaxed text-[#5E4F4A]">
              <p className="text-sm font-semibold text-[#2A1E1A]">
                One-Click Read-Only Copy
              </p>
              <p>
                Copy all existing team &amp; member accounts, hall bookings,
                vessel store items, floor layouts, and shared portal records into
                this portal.
              </p>
              <p className="text-[11px] text-[#7B6B63]">
                Nothing in your previous database is modified or deleted.
              </p>
            </div>
          </div>
        </div>

        {doneResult ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-medium text-emerald-900">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="font-semibold">Sync Completed</p>
                <p className="mt-0.5">
                  Copied{" "}
                  <strong>
                    {doneResult.totalImported.toLocaleString("en-IN")}
                  </strong>{" "}
                  records including <strong>{doneResult.usersSynced}</strong>{" "}
                  accounts. You can now sign in with your existing username and
                  password.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => router.push("/login")}
              leftIcon={<LogIn className="h-4 w-4" />}
              className="w-full"
            >
              Continue to Sign In
            </Button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={syncing}
              onClick={handleSync}
              leftIcon={<RefreshCw className="h-4 w-4" />}
              className="w-full"
            >
              {syncing
                ? "Copying Records from Previous Database..."
                : "Sync Data from Previous Database"}
            </Button>
          </div>
        )}

        <ArabesqueDivider arabicLabel="شباب العيد الذهبي" className="mt-6" />

        <div className="mt-2 text-center">
          <Link
            href="/login"
            className="text-xs font-semibold text-[#6A1B1B] hover:underline"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
