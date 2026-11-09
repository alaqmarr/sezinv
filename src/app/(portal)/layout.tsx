import React from "react";
import { connection } from "next/server";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { getISTTodayString } from "@sezsec/shared";
import { AuthSessionProvider } from "@sezsec/rbac";
import {
  ensureDefaultModulesSeeded,
  requireServerSession,
} from "@sezsec/rbac/rbac.server";
import { ensureStarterVenuesIfEmpty } from "@sezsec/settings/settings.service";
import { PortalShell } from "@sezsec/ui";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const user = await requireServerSession();
  const [unlockStatus] = await Promise.all([
    getAmountUnlockStatus(user.id, user.canViewCharges),
    ensureDefaultModulesSeeded(),
    ensureStarterVenuesIfEmpty(),
  ]);
  const todayIso = getISTTodayString();

  return (
    <AuthSessionProvider
      user={user}
      amountUnlocked={unlockStatus.unlocked}
      amountUnlockExpiresAt={unlockStatus.expiresAt}
    >
      <PortalShell todayIso={todayIso}>{children}</PortalShell>
    </AuthSessionProvider>
  );
}
