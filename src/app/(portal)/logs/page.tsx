import React, { Suspense } from "react";
import { connection } from "next/server";
import { listRecentActivity } from "@sezsec/logs";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { PageHeader, Skeleton } from "@sezsec/ui";
import { ActivityHistoryClient } from "./activity-history.client";

async function ActivityLogsContent() {
  await connection();
  await requireServerPageAccess("/logs");
  const entries = await listRecentActivity(2500);
  return <ActivityHistoryClient entries={entries} />;
}

export default function ActivityLogsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity History"
        arabicBadge="سجل الأعمال"
        subtitle="Day-to-day log of bookings, store items, charge updates, and staff actions."
      />
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        }
      >
        <ActivityLogsContent />
      </Suspense>
    </div>
  );
}
