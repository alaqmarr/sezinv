import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { db, withWriteLock } from "@sezsec/db";
import { getFreshSessionUser, type SessionUser } from "@sezsec/auth";
import type { AppRole } from "@sezsec/shared";
import { DEFAULT_PORTAL_MODULES } from "./rbac.constants";
import { canAccessPage } from "./rbac.helper";

export async function ensureDefaultModulesSeeded(): Promise<void> {
  const count = await db.module.count();
  if (count > 0) return;

  await withWriteLock(async () => {
    for (const mod of DEFAULT_PORTAL_MODULES) {
      await db.module.upsert({
        where: { id: mod.id },
        update: {},
        create: {
          id: mod.id,
          name: mod.name,
          description: mod.description,
          icon: mod.icon,
        },
      });
    }
  });
}

export async function requireServerSession(): Promise<SessionUser> {
  const user = await getFreshSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireServerPageAccess(pathname: string): Promise<SessionUser> {
  const user = await requireServerSession();
  if (!canAccessPage(pathname, user.role)) {
    redirect("/unauthorized");
  }
  return user;
}

export const requirePageAccess = requireServerPageAccess;

export async function requireApiAuth(
  allowedRoles?: AppRole[]
): Promise<
  | { ok: true; user: SessionUser }
  | { ok: false; response: NextResponse }
> {
  const user = await getFreshSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Please sign in to continue." },
        { status: 401 }
      ),
    };
  }

  if (
    allowedRoles &&
    user.role !== "ADMIN" &&
    !allowedRoles.includes(user.role)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "You do not have permission for this action." },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user };
}
