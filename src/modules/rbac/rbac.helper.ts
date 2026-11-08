import type { AppRole } from "@sezsec/shared";
import {
  ACTION_ACCESS_RULES,
  EVENT_CHARGES_MODULE_ID,
  PAGE_ACCESS_RULES,
} from "./rbac.constants";

export function isAdminRole(role: AppRole | string | undefined | null): boolean {
  return role === "ADMIN";
}

export function hasEventChargesModule(
  role: AppRole | string | undefined | null,
  moduleIds?: readonly string[] | null
): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  if (!moduleIds || moduleIds.length === 0) return false;
  return (
    moduleIds.includes(EVENT_CHARGES_MODULE_ID) ||
    moduleIds.includes("event-charges")
  );
}

export function isManagerOrAbove(role: AppRole | string | undefined | null): boolean {
  return role === "ADMIN" || role === "ADMIN_CUSTOM" || role === "MANAGER";
}

export function isStaffOrAbove(role: AppRole | string | undefined | null): boolean {
  return (
    role === "ADMIN" ||
    role === "ADMIN_CUSTOM" ||
    role === "MANAGER" ||
    role === "STAFF"
  );
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\[\\\.\\\.\\\.[^\\\]]+\\\]/g, ".+")
    .replace(/\\\[[^\\\]]+\\\]/g, "[^/]+");
  return new RegExp(`^${escaped}$`);
}

const SORTED_PAGE_PATTERNS = Object.entries(PAGE_ACCESS_RULES)
  .sort((a, b) => b[0].length - a[0].length)
  .map(([pattern, roles]) => ({
    pattern,
    regex: patternToRegex(pattern),
    roles,
  }));

export function canAccessPage(
  pathname: string,
  role: AppRole | string | undefined | null
): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;

  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const entry of SORTED_PAGE_PATTERNS) {
    if (entry.regex.test(clean)) {
      return entry.roles.includes(role as AppRole);
    }
  }
  return false;
}

export function canPerformAction(
  actionKey: string,
  role: AppRole | string | undefined | null
): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  const allowed = ACTION_ACCESS_RULES[actionKey];
  if (!allowed) return false;
  return allowed.includes(role as AppRole);
}
