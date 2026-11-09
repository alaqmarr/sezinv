"use client";

import React, { useState } from "react";
import {
  Building2,
  Database,
  Mail,
  ScrollText,
  Sparkles,
  Users,
  Utensils,
} from "lucide-react";
import type { MigrationPreviewReport } from "@sezsec/migration";
import type { PortalMasterSettings } from "@sezsec/settings";
import type { TeamMemberRecord } from "@sezsec/users";
import { Tabs, type TabItem } from "@sezsec/ui";
import { GuidelinesSettingsPanel } from "./guidelines.panel";
import {
  ContactDirectoryPanel,
  HallsDirectoryPanel,
} from "./directories.panel";
import { TeamManagementPanel } from "./team.panel";
import { DatabaseMigrationPanel } from "./migration.panel";
import { SystemMaintenancePanel, type HealthPayload } from "./system.panel";

export function SettingsHubClient({
  initialTab,
  settings,
  teamMembers,
  currentUserId,
  currentUserEmail,
  isFullAdmin,
  initialHealth,
  initialMigrationReport,
}: {
  initialTab?: string;
  settings: PortalMasterSettings;
  teamMembers: TeamMemberRecord[];
  currentUserId: string;
  currentUserEmail: string | null;
  isFullAdmin: boolean;
  initialHealth: HealthPayload;
  initialMigrationReport: MigrationPreviewReport | null;
}) {
  const tabs: TabItem[] = [
    {
      id: "guidelines",
      label: "Rules & Do's / Don'ts",
      icon: <ScrollText className="h-3.5 w-3.5" />,
    },
    {
      id: "venues",
      label: "Halls & Venues",
      count: settings.halls.length,
      icon: <Building2 className="h-3.5 w-3.5" />,
    },
    {
      id: "caterers",
      label: "Caterers",
      count: settings.caterers.length,
      icon: <Utensils className="h-3.5 w-3.5" />,
    },
    {
      id: "decorators",
      label: "Decorators",
      count: settings.decorators.length,
      icon: <Sparkles className="h-3.5 w-3.5" />,
    },
    ...(isFullAdmin
      ? [
          {
            id: "team",
            label: "Team Members",
            count: teamMembers.length,
            icon: <Users className="h-3.5 w-3.5" />,
          },
          {
            id: "migration",
            label: "Sync Online Records",
            icon: <Database className="h-3.5 w-3.5" />,
          },
        ]
      : []),
    {
      id: "system",
      label: "Email & Backups",
      icon: <Mail className="h-3.5 w-3.5" />,
    },
  ];

  const validInitial =
    initialTab && tabs.some((t) => t.id === initialTab)
      ? initialTab
      : "guidelines";

  const [activeTab, setActiveTab] = useState(validInitial);

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />

      {activeTab === "guidelines" ? (
        <GuidelinesSettingsPanel
          initialWindowMinutes={settings.bookingWindowMinutes}
          initialGuidelines={settings.guidelines}
        />
      ) : null}

      {activeTab === "venues" ? (
        <HallsDirectoryPanel initialHalls={settings.halls} />
      ) : null}

      {activeTab === "caterers" ? (
        <ContactDirectoryPanel
          kind="caterers"
          initialItems={settings.caterers}
        />
      ) : null}

      {activeTab === "decorators" ? (
        <ContactDirectoryPanel
          kind="decorators"
          initialItems={settings.decorators}
        />
      ) : null}

      {activeTab === "team" && isFullAdmin ? (
        <TeamManagementPanel
          initialMembers={teamMembers}
          currentUserId={currentUserId}
        />
      ) : null}

      {activeTab === "migration" && isFullAdmin && initialMigrationReport ? (
        <DatabaseMigrationPanel initialReport={initialMigrationReport} />
      ) : null}

      {activeTab === "system" ? (
        <SystemMaintenancePanel
          userEmail={currentUserEmail}
          isAdmin={isFullAdmin}
          initialEmailSettings={settings.emailSettings}
          initialHealth={initialHealth}
        />
      ) : null}
    </div>
  );
}
