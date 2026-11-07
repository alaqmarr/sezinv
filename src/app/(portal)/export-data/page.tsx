import React, { Suspense } from "react";
import { connection } from "next/server";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader, Skeleton } from "@sezsec/ui";
import { ExportSheetsClient } from "./export-sheets.client";

async function ExportDataContent() {
  await connection();
  await requireServerPageAccess("/export-data");
  return <ExportSheetsClient />;
}

export default function ExportDataPage() {
  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Download Excel Sheets"
        arabicBadge="تنزيل الجداول"
        subtitle="Download office bookings, vessel stock, and movement registers as clean Excel files."
      />
      <Suspense fallback={<Skeleton className="h-80 w-full" />}>
        <ExportDataContent />
      </Suspense>
    </div>
  );
}
