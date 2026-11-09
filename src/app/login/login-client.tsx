"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  DatabaseBackup,
  KeyRound,
  LogIn,
  RefreshCw,
  User,
} from "lucide-react";
import {
  ArabesqueDivider,
  Button,
  Input,
  KeelArchBanner,
  notify,
} from "@sezsec/ui";

export function LoginClient({
  initialNoAccountsLocally,
  neonConfigured,
}: {
  initialNoAccountsLocally: boolean;
  neonConfigured: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [noAccountsLocally, setNoAccountsLocally] = useState(
    initialNoAccountsLocally
  );
  const [accountNotFound, setAccountNotFound] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncedSummary, setSyncedSummary] = useState<{
    usersSynced: number;
    totalImported: number;
  } | null>(null);

  const handleSyncFromPreviousDb = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/setup/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        notify.error(
          "Sync could not finish",
          data.error || "Please check your internet connection and try again."
        );
        return;
      }

      setNoAccountsLocally(false);
      setAccountNotFound(false);
      setSyncedSummary({
        usersSynced: Number(data.usersSynced ?? 0),
        totalImported: Number(data.totalImported ?? 0),
      });

      notify.success(
        "Records synced successfully",
        data.mode === "full"
          ? `Copied ${Number(data.totalImported ?? 0).toLocaleString("en-IN")} records (${data.usersSynced} accounts). Please sign in below.`
          : `Synced ${data.usersSynced} accounts. Please sign in below.`
      );
    } catch {
      notify.error(
        "Network error",
        "Could not reach the server to sync records."
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAccountNotFound(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.accountNotFound) {
          setAccountNotFound(true);
        }
        notify.error(
          "Sign in failed",
          data.error || "Please check your details."
        );
        return;
      }
      notify.success(
        "Welcome back",
        `Signed in as ${data.user.name || data.user.username}`
      );
      router.push("/");
      router.refresh();
    } catch {
      notify.error("Network error", "Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const showSyncCard =
    neonConfigured && (noAccountsLocally || accountNotFound);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-5">
        <div className="jadwal-card jadwal-double-frame overflow-hidden rounded-3xl bg-white p-6 sm:p-8">
          <div className="mb-5 flex flex-col items-center text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/crest.png"
              alt="Anjuman-e-Mohammedi Crest"
              className="mb-3 h-20 w-20 rounded-full border border-[#D9C398] bg-[#231917] object-contain p-1 shadow-xs"
            />
            <KeelArchBanner
              arabicTitle="انجمن محمدي سکندرآباد"
              subtitle="Anjuman-e-Mohammedi, Secunderabad"
              className="w-full"
            />
            <p className="mt-3 text-xs font-medium text-[#7B6B63]">
              Dawoodi Bohra Jamaat Trust • Hall Booking &amp; Vessel Store Portal
            </p>
          </div>

          {showSyncCard ? (
            <div className="mb-5 rounded-2xl border border-[#D9C398] bg-[#FBF6EB] p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D9C398] bg-white text-[#6A1B1B]">
                  <DatabaseBackup className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#6A1B1B]">
                    {noAccountsLocally
                      ? "No Accounts Found Here Yet — Sync Office Records"
                      : "Account Not Found Here Yet — Sync Office Accounts"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[#5E4F4A]">
                    {noAccountsLocally
                      ? "This portal has no saved accounts yet. Click below to bring over all existing accounts, hall bookings, store items, and records from your previous office system."
                      : `The username "${username.trim()}" is not saved in this portal yet. Click below to sync accounts and records from your previous office system, then sign in.`}
                  </p>
                  <div className="mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      loading={syncing}
                      onClick={handleSyncFromPreviousDb}
                      leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                    >
                      {syncing
                        ? "Syncing Office Records..."
                        : "Sync Previous Office Records"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {syncedSummary ? (
            <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs font-medium text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
              <span>
                Synced{" "}
                <strong>
                  {syncedSummary.totalImported.toLocaleString("en-IN")}
                </strong>{" "}
                records ({syncedSummary.usersSynced} accounts). Sign in with your
                existing username and password below.
              </span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (accountNotFound) setAccountNotFound(false);
              }}
              placeholder="Enter your username"
              leftAddon={<User className="h-4 w-4" />}
            />

            <Input
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              leftAddon={<KeyRound className="h-4 w-4" />}
            />

            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-semibold text-[#6A1B1B] hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={syncing}
              leftIcon={<LogIn className="h-4 w-4" />}
              className="w-full"
            >
              Sign In to Portal
            </Button>
          </form>

          <ArabesqueDivider
            arabicLabel="شباب العيد الذهبي"
            className="mt-6"
          />
          <p className="mt-1 text-center text-[11px] text-[#8C7B73]">
            Shababul Eidiz Zahabi, Secunderabad
          </p>
        </div>
      </div>
    </div>
  );
}
