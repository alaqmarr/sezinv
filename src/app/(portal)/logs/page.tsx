import { connection } from "next/server";
import { listRecentActivity } from "@sezsec/logs";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader } from "@sezsec/ui";
import { ActivityHistoryClient } from "./activity-history.client";

export default async function ActivityLogsPage() {
  await connection();
  await requireServerPageAccess("/logs");
  const entries = await listRecentActivity(2500);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity History"
        arabicBadge="سجل الأعمال"
        subtitle="Day-to-day log of bookings, store items, charge updates, and staff actions."
      />
      <ActivityHistoryClient entries={entries} />
    </div>
  );
}
