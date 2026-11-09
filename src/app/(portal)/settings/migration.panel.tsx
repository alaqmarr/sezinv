"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type {
  MigrationPreviewReport,
  MigrationRunResult,
} from "@sezsec/migration";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  ConfirmDialog,
  StatTile,
  notify,
} from "@sezsec/ui";

export function DatabaseMigrationPanel({
  initialReport,
}: {
  initialReport: MigrationPreviewReport;
}) {
  const router = useRouter();
  const [report, setReport] = useState<MigrationPreviewReport>(initialReport);
  const [loadingPreview, setLoadingPreview] = useState(
    Boolean(initialReport.neonConfigured && !initialReport.onlineChecked)
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [lastResult, setLastResult] = useState<MigrationRunResult | null>(null);

  const refreshComparison = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const res = await fetch("/api/migration/neon");
      const data = (await res.json()) as MigrationPreviewReport;
      setReport(data);
    } catch {
      notify.error("Could not check records", "Please refresh and try again.");
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (!initialReport.neonConfigured || initialReport.onlineChecked) {
      return;
    }
    let active = true;
    fetch("/api/migration/neon")
      .then((res) => res.json())
      .then((data: MigrationPreviewReport) => {
        if (active) setReport(data);
      })
      .catch(() => {
        if (active) {
          notify.error(
            "Could not check records",
            "Please refresh and try again."
          );
        }
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });
    return () => {
      active = false;
    };
  }, [initialReport.neonConfigured, initialReport.onlineChecked]);

  const handleRunMigration = async () => {
    setMigrating(true);
    try {
      const res = await fetch("/api/migration/neon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        notify.error(
          "Could not complete sync",
          data.error || "Please check your internet connection."
        );
        return;
      }
      setLastResult(data as MigrationRunResult);
      setConfirmOpen(false);
      notify.success(
        "All records synced!",
        `Copied ${data.totalImported.toLocaleString("en-IN")} records into this portal.`
      );
      await refreshComparison();
      router.refresh();
    } catch {
      notify.error("Network error", "Sync could not finish.");
    } finally {
      setMigrating(false);
    }
  };

  const eventsStoreTables = report.tables.filter(
    (t) => t.group === "Events & Store"
  );
  const sharedPortalTables = report.tables.filter(
    (t) => t.group === "Shared Jamaat Portal"
  );

  const onlinePendingCheck =
    report.neonConfigured && !report.onlineChecked && loadingPreview;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#C6DFCF] bg-[#F4FAF6] p-4 text-sm text-[#23583A]">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#23583A]" />
          <div>
            <p className="font-semibold">
              100% Read-Only on Your Online Jamaat Database
            </p>
            <p className="mt-0.5 text-xs text-[#2E6947]">
              Your existing online Jamaat database (shared with the members
              website) is opened strictly in read-only mode and is{" "}
              <strong>never altered, overwritten, or deleted</strong>. All 24
              record groups—including hall bookings, store vessels, members,
              khidmat requests, thaali fees, and attendance—are safely synced
              into this portal.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label="Online Jamaat Records"
          value={
            onlinePendingCheck
              ? "—"
              : report.neonReachable
                ? report.totalNeonRows.toLocaleString("en-IN")
                : "Offline"
          }
          hint={
            onlinePendingCheck
              ? "Comparing live online counts..."
              : report.neonReachable
                ? "Total records found online"
                : report.error || "Connection unavailable"
          }
          tone="brass"
          icon={<Database className="h-5 w-5" />}
        />
        <StatTile
          label="This Portal (Office Records)"
          value={report.totalSqliteRows.toLocaleString("en-IN")}
          hint="Records currently stored on this portal"
          tone="maroon"
          icon={<Database className="h-5 w-5" />}
        />
        <StatTile
          label="Sync Readiness"
          value={
            onlinePendingCheck
              ? "Checking"
              : report.neonReachable
                ? "Ready"
                : "Needs Check"
          }
          hint="Safe one-click sync anytime"
          tone={
            onlinePendingCheck
              ? "brass"
              : report.neonReachable
                ? "sage"
                : "crimson"
          }
          icon={
            report.neonReachable ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <TriangleAlert className="h-5 w-5" />
            )
          }
        />
      </div>

      {lastResult ? (
        <Card className="border-[#B7DBC3] bg-[#F4FAF6]/80">
          <CardBody className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-[#23583A]">
                <CheckCircle2 className="h-5 w-5" />
                <span>
                  Sync Completed in {(lastResult.durationMs / 1000).toFixed(1)}{" "}
                  seconds — {lastResult.totalImported.toLocaleString("en-IN")}{" "}
                  records copied/updated!
                </span>
              </div>
              <Badge tone="sage">Completed Safely</Badge>
            </div>
            {lastResult.warnings.length > 0 ? (
              <ul className="list-disc pl-5 text-xs text-[#78551B]">
                {lastResult.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <Card accentTop>
        <CardHeader
          title="One-Click Sync from Online Jamaat Records"
          subtitle="Review live record counts side-by-side before syncing."
          arabicRight="نقل السجلات"
          action={
            <Button
              variant="secondary"
              size="sm"
              loading={loadingPreview}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={refreshComparison}
            >
              Refresh Counts
            </Button>
          }
        />
        <CardBody className="space-y-6">
          {!onlinePendingCheck && !report.neonReachable ? (
            <div className="rounded-xl border border-[#EEC2C2] bg-[#FDF0F0] p-4 text-xs text-[#991B1B]">
              <strong>Could not connect to online database:</strong>{" "}
              {report.error ||
                "Please check your internet connection and try again."}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Group 1: Events & Store */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6A1B1B]">
                Hall Bookings &amp; Vessel Store
              </h4>
              <div className="overflow-x-auto rounded-xl border border-[#EAE2D6]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF7F2] font-semibold text-[#7B6B63]">
                    <tr>
                      <th className="px-3.5 py-2.5">Record Group</th>
                      <th className="px-3.5 py-2.5 text-right">Online</th>
                      <th className="px-3.5 py-2.5 text-right">This Portal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E9DD]">
                    {eventsStoreTables.map((row) => (
                      <tr key={row.table}>
                        <td className="px-3.5 py-2.5 font-medium text-[#231917]">
                          {row.label}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-[#78551B]">
                          {onlinePendingCheck
                            ? "—"
                            : row.neonCount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-[#23583A]">
                          {row.sqliteCount.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Group 2: Shared Jamaat Portal */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#6A1B1B]">
                Shared Jamaat Member &amp; Portal Records
              </h4>
              <div className="overflow-x-auto rounded-xl border border-[#EAE2D6]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF7F2] font-semibold text-[#7B6B63]">
                    <tr>
                      <th className="px-3.5 py-2.5">Record Group</th>
                      <th className="px-3.5 py-2.5 text-right">Online</th>
                      <th className="px-3.5 py-2.5 text-right">This Portal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0E9DD]">
                    {sharedPortalTables.map((row) => (
                      <tr key={row.table}>
                        <td className="px-3.5 py-2.5 font-medium text-[#231917]">
                          {row.label}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-[#78551B]">
                          {onlinePendingCheck
                            ? "—"
                            : row.neonCount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-[#23583A]">
                          {row.sqliteCount.toLocaleString("en-IN")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardBody>
        <CardFooter>
          <span className="text-xs text-[#6E5D55]">
            Safe to run multiple times — existing records are updated cleanly
            without duplicates.
          </span>
          <Button
            variant="primary"
            disabled={!report.neonReachable}
            loading={migrating}
            rightIcon={<ArrowRight className="h-4 w-4" />}
            onClick={() => setConfirmOpen(true)}
          >
            Sync All Records (One Click)
          </Button>
        </CardFooter>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleRunMigration}
        loading={migrating}
        title="Start One-Click Records Sync?"
        message="This will copy all bookings, halls, caterers, vessels, staff accounts, and shared Jamaat member records from your online database into this portal. Nothing on your online database will be modified."
        confirmLabel="Yes, Sync All Records Now"
      />
    </div>
  );
}
