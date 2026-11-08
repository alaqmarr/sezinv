import bcrypt from "bcryptjs";
import { db, withWriteLock, withWriteTransaction } from "@sezsec/db";
import { recordActivity } from "@sezsec/logs";
import { DEFAULT_PORTAL_MODULES } from "@sezsec/rbac/rbac.constants";
import { hasEventChargesModule } from "@sezsec/rbac/rbac.helper";
import type { AppRole } from "@sezsec/shared";
import {
  getSessionFromCookies,
  setSessionCookie,
} from "./session.helper";
import type { SessionUser } from "./auth.types";

function toSessionUser(user: {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  role: string;
  profileStatus: string | null;
  moduleAccess?: Array<{ moduleId: string }>;
  moduleIds?: string[];
}): SessionUser {
  const role = user.role as AppRole;
  const moduleIds = user.moduleIds
    ? [...user.moduleIds]
    : (user.moduleAccess ?? []).map((m) => m.moduleId);
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role,
    profileStatus:
      user.profileStatus === "COMPLETED" || user.profileStatus === "SKIPPED"
        ? user.profileStatus
        : null,
    moduleIds,
    canViewCharges: hasEventChargesModule(role, moduleIds),
  };
}

export async function isInitialSetupRequired(): Promise<boolean> {
  const count = await db.user.count();
  return count === 0;
}

export async function getFreshSessionUser(): Promise<SessionUser | null> {
  const cookieUser = await getSessionFromCookies();
  if (!cookieUser) return null;

  const dbUser = await db.user.findUnique({
    where: { id: cookieUser.id },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      mobile: true,
      role: true,
      profileStatus: true,
      moduleAccess: {
        select: { moduleId: true },
      },
    },
  });

  if (!dbUser) return null;
  return toSessionUser(dbUser);
}

export async function loginWithPassword(
  usernameInput: string,
  passwordInput: string
): Promise<
  | { ok: true; user: SessionUser }
  | { ok: false; error: string; accountNotFound?: boolean }
> {
  const username = usernameInput.trim();
  if (!username || !passwordInput) {
    return { ok: false, error: "Please enter both your username and password." };
  }

  const user = await db.user.findUnique({
    where: { username },
    include: {
      moduleAccess: {
        select: { moduleId: true },
      },
    },
  });

  if (!user) {
    const neonConfigured = Boolean(process.env.NEON_DATABASE_URL?.trim());
    return {
      ok: false,
      accountNotFound: neonConfigured,
      error: neonConfigured
        ? "This account is not in the local database yet. Sync from the previous database below and sign in again."
        : "Invalid username or password.",
    };
  }

  let passwordMatches = false;
  if (user.password.startsWith("$2")) {
    passwordMatches = await bcrypt.compare(passwordInput, user.password);
  } else {
    // Support legacy non-hashed passwords migrated from historical sheets & upgrade to bcrypt
    passwordMatches = user.password === passwordInput;
    if (passwordMatches) {
      const upgradedHash = await bcrypt.hash(passwordInput, 10);
      await withWriteLock(() =>
        db.user.update({
          where: { id: user.id },
          data: { password: upgradedHash },
        })
      );
    }
  }

  if (!passwordMatches) {
    return { ok: false, error: "Invalid username or password." };
  }

  const sessionUser = toSessionUser(user);
  await setSessionCookie(sessionUser);

  await recordActivity({
    action: "USER_LOGIN",
    summary: `${sessionUser.name || sessionUser.username} signed in`,
    userId: sessionUser.id,
    userName: sessionUser.name || sessionUser.username,
  });

  return { ok: true, user: sessionUser };
}

export async function setupInitialAdministrator(input: {
  name: string;
  username: string;
  email: string;
  mobile: string;
  password: string;
}): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const existingCount = await db.user.count();
  if (existingCount > 0) {
    return {
      ok: false,
      error: "Administrator account is already set up. Please sign in.",
    };
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);
  const created = await withWriteTransaction(async (tx) => {
    for (const mod of DEFAULT_PORTAL_MODULES) {
      await tx.module.upsert({
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

    const adminUser = await tx.user.create({
      data: {
        name: input.name.trim(),
        username: input.username.trim(),
        email: input.email.trim().toLowerCase(),
        mobile: input.mobile.trim(),
        password: hashedPassword,
        role: "ADMIN",
        profileStatus: "COMPLETED",
      },
    });

    for (const mod of DEFAULT_PORTAL_MODULES) {
      await tx.userModuleAccess.create({
        data: {
          userId: adminUser.id,
          moduleId: mod.id,
        },
      });
    }

    return {
      ...adminUser,
      moduleIds: DEFAULT_PORTAL_MODULES.map((m) => m.id),
    };
  });

  const sessionUser = toSessionUser(created);
  await setSessionCookie(sessionUser);

  await recordActivity({
    action: "USER_CREATED",
    summary: `Initial Administrator account created (${sessionUser.username})`,
    userId: sessionUser.id,
    userName: sessionUser.name || sessionUser.username,
  });

  return { ok: true, user: sessionUser };
}
