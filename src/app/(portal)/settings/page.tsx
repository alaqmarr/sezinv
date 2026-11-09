import { connection } from "next/server";
import { getDatabaseHealth } from "@sezsec/db";
import {
  getLocalMigrationBaselineReport,
  inspectNeonVsSqliteCounts,
} from "@sezsec/migration/neon-sync.service";
import { getResolvedSmtpCredentials } from "@sezsec/notifications/smtp-config.helper";
import { requireServerPageAccess } from "@sezsec/rbac/rbac.server";
import { getPortalMasterSettings } from "@sezsec/settings/settings.service";
import { listTeamMembers } from "@sezsec/users/users.service";
import { PageHeader } from "@sezsec/ui";
import { SettingsHubClient } from "./settings-hub.client";

export default async function OfficeSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await connection();
  const [user, sp] = await Promise.all([
    requireServerPageAccess("/settings"),
    searchParams,
  ]);
  const isFullAdmin = user.role === "ADMIN";

  const [settings, teamMembers, databaseHealth, smtp, migrationReport] =
    await Promise.all([
      getPortalMasterSettings(),
      isFullAdmin ? listTeamMembers() : Promise.resolve([]),
      getDatabaseHealth(),
      getResolvedSmtpCredentials(),
      isFullAdmin
        ? sp.tab === "migration"
          ? inspectNeonVsSqliteCounts()
          : getLocalMigrationBaselineReport()
        : Promise.resolve(null),
    ]);

  const initialHealth = {
    database: databaseHealth,
    emailConfigured: smtp.configured,
    senderEmail: smtp.smtpEmail,
    neonSourceConfigured: Boolean(process.env.NEON_DATABASE_URL),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Office Settings"
        arabicBadge="إعدادات المكتب"
        subtitle="Manage halls, caterers, decorators, printed Do's & Don'ts, staff access, and one-click data import."
      />
      <SettingsHubClient
        initialTab={sp.tab}
        settings={settings}
        teamMembers={teamMembers}
        currentUserId={user.id}
        currentUserEmail={user.email}
        isFullAdmin={isFullAdmin}
        initialHealth={initialHealth}
        initialMigrationReport={migrationReport}
      />
    </div>
  );
}
