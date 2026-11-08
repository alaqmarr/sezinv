"use client";

import React, { createContext, useContext } from "react";
import type { SessionUser } from "@sezsec/auth/auth.types";
import { canPerformAction, isAdminRole, isManagerOrAbove, isStaffOrAbove } from "./rbac.helper";

interface AuthContextValue {
  user: SessionUser;
  amountUnlocked: boolean;
  amountUnlockExpiresAt: number | null;
}

const AuthSessionContext = createContext<AuthContextValue | null>(null);

export function AuthSessionProvider({
  user,
  amountUnlocked,
  amountUnlockExpiresAt,
  children,
}: {
  user: SessionUser;
  amountUnlocked: boolean;
  amountUnlockExpiresAt: number | null;
  children: React.ReactNode;
}) {
  return (
    <AuthSessionContext.Provider
      value={{ user, amountUnlocked, amountUnlockExpiresAt }}
    >
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthContextValue {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used inside AuthSessionProvider");
  }
  return ctx;
}

export function usePermissions() {
  const { user, amountUnlocked, amountUnlockExpiresAt } = useAuthSession();
  return {
    user,
    role: user.role,
    isAdmin: isAdminRole(user.role),
    isManagerOrAbove: isManagerOrAbove(user.role),
    isStaffOrAbove: isStaffOrAbove(user.role),
    canViewCharges: user.canViewCharges,
    canEditCharges:
      user.canViewCharges && canPerformAction("event:costs:edit", user.role),
    amountUnlocked: user.canViewCharges && amountUnlocked,
    amountUnlockExpiresAt: user.canViewCharges ? amountUnlockExpiresAt : null,
    hasModule: (moduleId: string) =>
      user.role === "ADMIN" || user.moduleIds.includes(moduleId),
    can: (actionKey: string) => {
      if (actionKey === "event:costs:view") {
        return user.canViewCharges;
      }
      if (actionKey === "event:costs:edit") {
        return (
          user.canViewCharges && canPerformAction("event:costs:edit", user.role)
        );
      }
      return canPerformAction(actionKey, user.role);
    },
  };
}

export function ProtectAction({
  action,
  fallback = null,
  children,
}: {
  action: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can } = usePermissions();
  if (!can(action)) return <>{fallback}</>;
  return <>{children}</>;
}
