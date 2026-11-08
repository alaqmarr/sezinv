import bcrypt from "bcryptjs";
import { pushUserDeleteToSezsec, syncUserByIdToSezsec } from "@sezsec/bridge";
import { db, withWriteTransaction } from "@sezsec/db";
import { ROLE_LABELS, type AppRole } from "@sezsec/shared";
import { recordActivity } from "@sezsec/logs";
import {
  buildWelcomeUserHtml,
  sendPortalEmail,
} from "@sezsec/notifications";
import {
  DEFAULT_PORTAL_MODULES,
  DEFAULT_STAFF_MODULE_IDS,
  EVENT_CHARGES_MODULE_ID,
} from "@sezsec/rbac/rbac.constants";

export interface TeamMemberRecord {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  its: string | null;
  role: AppRole;
  profileStatus: string | null;
  moduleIds: string[];
  createdAt: string;
}

export async function listTeamMembers(): Promise<TeamMemberRecord[]> {
  const rows = await db.user.findMany({
    include: {
      moduleAccess: {
        select: { moduleId: true },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((u) => ({
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    its: u.its,
    role: u.role as AppRole,
    profileStatus: u.profileStatus,
    moduleIds: u.moduleAccess.map((m) => m.moduleId),
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function createTeamMember(
  input: {
    username: string;
    password: string;
    name: string;
    email?: string;
    mobile?: string;
    its?: string;
    role: AppRole;
    moduleIds?: string[];
  },
  actor: { id: string; name: string }
): Promise<TeamMemberRecord> {
  const hashedPassword = await bcrypt.hash(input.password, 10);
  const rawMods =
    input.moduleIds ??
    (input.role === "ADMIN"
      ? DEFAULT_PORTAL_MODULES.map((m) => m.id)
      : [...DEFAULT_STAFF_MODULE_IDS]);
  const requestedMods = Array.from(
    new Set(
      input.role === "ADMIN"
        ? [...rawMods, EVENT_CHARGES_MODULE_ID]
        : rawMods
    )
  );

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

    const validModules =
      requestedMods.length > 0
        ? await tx.module.findMany({
            where: { id: { in: requestedMods } },
            select: { id: true },
          })
        : [];

    const user = await tx.user.create({
      data: {
        username: input.username.trim(),
        password: hashedPassword,
        name: input.name.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        mobile: input.mobile?.trim() || null,
        its: input.its?.trim() || null,
        role: input.role,
        profileStatus:
          input.email && input.mobile ? "COMPLETED" : null,
      },
    });

    for (const mod of validModules) {
      await tx.userModuleAccess.create({
        data: {
          userId: user.id,
          moduleId: mod.id,
        },
      });
    }

    return tx.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { moduleAccess: { select: { moduleId: true } } },
    });
  });

  await syncUserByIdToSezsec(created.id);
  await recordActivity({
    action: "USER_CREATED",
    summary: `Added team member ${created.name || created.username} (${ROLE_LABELS[created.role] || created.role})`,
    userId: actor.id,
    userName: actor.name,
  });

  if (created.email) {
    void sendPortalEmail({
      to: created.email,
      subject: "Your Jamaat Events Portal Account",
      html: buildWelcomeUserHtml({
        name: created.name || created.username,
        username: created.username,
        roleLabel: ROLE_LABELS[created.role] || created.role,
      }),
    });
  }

  return {
    id: created.id,
    username: created.username,
    name: created.name,
    email: created.email,
    mobile: created.mobile,
    its: created.its,
    role: created.role as AppRole,
    profileStatus: created.profileStatus,
    moduleIds: created.moduleAccess.map((m) => m.moduleId),
    createdAt: created.createdAt.toISOString(),
  };
}

export async function updateTeamMember(
  userId: string,
  input: {
    name?: string;
    email?: string;
    mobile?: string;
    its?: string;
    role?: AppRole;
    newPassword?: string;
    moduleIds?: string[];
  },
  actor: { id: string; name: string }
): Promise<void> {
  const passwordHash = input.newPassword?.trim()
    ? await bcrypt.hash(input.newPassword.trim(), 10)
    : undefined;

  const updated = await withWriteTransaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() || null } : {}),
        ...(input.email !== undefined
          ? { email: input.email.trim().toLowerCase() || null }
          : {}),
        ...(input.mobile !== undefined
          ? { mobile: input.mobile.trim() || null }
          : {}),
        ...(input.its !== undefined ? { its: input.its.trim() || null } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(passwordHash ? { password: passwordHash } : {}),
      },
    });

    if (input.moduleIds) {
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

      const targetRole = input.role ?? (user.role as AppRole);
      const uniqueIds = Array.from(
        new Set(
          targetRole === "ADMIN"
            ? [...input.moduleIds, EVENT_CHARGES_MODULE_ID]
            : input.moduleIds
        )
      );
      const validModules =
        uniqueIds.length > 0
          ? await tx.module.findMany({
              where: { id: { in: uniqueIds } },
              select: { id: true },
            })
          : [];

      await tx.userModuleAccess.deleteMany({ where: { userId } });
      for (const mod of validModules) {
        await tx.userModuleAccess.create({
          data: { userId, moduleId: mod.id },
        });
      }
    }

    return user;
  });

  await syncUserByIdToSezsec(updated.id);
  await recordActivity({
    action: "USER_UPDATED",
    summary: `Updated team member ${updated.name || updated.username}`,
    userId: actor.id,
    userName: actor.name,
  });
}

export async function deleteTeamMember(
  userId: string,
  actor: { id: string; name: string }
): Promise<void> {
  if (userId === actor.id) {
    throw new Error("You cannot remove your own signed-in account.");
  }

  const deleted = await withWriteTransaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: userId } });
    if (!target) throw new Error("Team member not found.");

    // Detach createdById on events so historical bookings remain intact
    await tx.event.updateMany({
      where: { createdById: userId },
      data: { createdById: null },
    });

    await tx.user.delete({ where: { id: userId } });
    return target;
  });

  await pushUserDeleteToSezsec(deleted.id, deleted.username);
  await recordActivity({
    action: "USER_DELETED",
    summary: `Removed team member ${deleted.name || deleted.username}`,
    userId: actor.id,
    userName: actor.name,
  });
}
