import { connection } from "next/server";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { ExportSheetsClient } from "./export-sheets.client";

export default async function ExportDataPage() {
  await connection();
  await requireServerPageAccess("/export-data");

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Download Excel Sheets"
        arabicBadge="تنزيل الجداول"
        subtitle="Download office bookings, vessel stock, and movement registers as clean Excel files."
      />
      <ExportSheetsClient />
    </div>
  );
}
