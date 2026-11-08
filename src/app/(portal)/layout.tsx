import React, { Suspense } from "react";
import { connection } from "next/server";
import { getAmountUnlockStatus } from "@sezsec/auth";
import { getISTTodayString } from "@sezsec/shared";
import { AuthSessionProvider } from "@sezsec/rbac";
import {
  ensureDefaultModulesSeeded,
  requireServerSession,
} from "@sezsec/rbac/rbac.server";
import { ensureStarterVenuesIfEmpty } from "@sezsec/settings/settings.service";
import { PortalShell, Skeleton } from "@sezsec/ui";

export const instant = false;

async function AuthenticatedPortalWrapper({
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

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          <Skeleton className="h-14 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <AuthenticatedPortalWrapper>{children}</AuthenticatedPortalWrapper>
    </Suspense>
  );
}
