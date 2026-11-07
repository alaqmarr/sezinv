import React, { Suspense } from "react";
import { connection } from "next/server";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { getPortalMasterSettings } from "@sezsec/settings/settings.service";
import { listTeamMembers } from "@sezsec/users/users.service";
import { PageHeader, Skeleton } from "@sezsec/ui";
import { SettingsHubClient } from "./settings-hub.client";

async function OfficeSettingsContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ tab?: string }>;
}) {
  await connection();
  const user = await requireServerPageAccess("/settings");
  const sp = await searchParamsPromise;
  const isFullAdmin = user.role === "ADMIN";

  const [settings, teamMembers] = await Promise.all([
    getPortalMasterSettings(),
    isFullAdmin ? listTeamMembers() : Promise.resolve([]),
  ]);

  return (
    <SettingsHubClient
      initialTab={sp.tab}
      settings={settings}
      teamMembers={teamMembers}
      currentUserId={user.id}
      currentUserEmail={user.email}
      isFullAdmin={isFullAdmin}
    />
  );
}

export default function OfficeSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Office Settings"
        arabicBadge="إعدادات المكتب"
        subtitle="Manage halls, caterers, decorators, printed Do's & Don'ts, staff access, and one-click data import."
      />
      <Suspense
        fallback={
          <div className="space-y-5">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-80 w-full" />
          </div>
        }
      >
        <OfficeSettingsContent searchParamsPromise={searchParams} />
      </Suspense>
    </div>
  );
}
