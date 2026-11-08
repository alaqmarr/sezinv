import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db, withWriteLock } from "@sezsec/db";
import { setSessionCookie, verifyEmailOtp } from "@sezsec/auth";
import type { AppRole } from "@sezsec/shared";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

export async function PATCH(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const skip = Boolean(body?.skip);

    const updated = await withWriteLock(() =>
      db.user.update({
        where: { id: auth.user.id },
        data: skip
          ? { profileStatus: "SKIPPED" }
          : {
              name:
                body?.name !== undefined
                  ? String(body.name).trim() || null
                  : auth.user.name,
              email:
                body?.email !== undefined
                  ? String(body.email).trim().toLowerCase() || null
                  : auth.user.email,
              mobile:
                body?.mobile !== undefined
                  ? String(body.mobile).trim() || null
                  : auth.user.mobile,
              profileStatus: "COMPLETED",
            },
      })
    );

    await setSessionCookie({
      id: updated.id,
      username: updated.username,
      name: updated.name,
      email: updated.email,
      mobile: updated.mobile,
      role: updated.role as AppRole,
      profileStatus:
        updated.profileStatus === "COMPLETED" ||
        updated.profileStatus === "SKIPPED"
          ? updated.profileStatus
          : null,
      moduleIds: auth.user.moduleIds,
      canViewCharges: auth.user.canViewCharges,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not save your profile." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  if (!auth.user.email) {
    return NextResponse.json(
      { error: "Please save your email address first." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const code = String(body?.code || "");
    const newPassword = String(body?.newPassword || "");

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const verified = await verifyEmailOtp({
      email: auth.user.email,
      code,
      purpose: "PROFILE_PASSWORD",
    });

    if (!verified.valid) {
      return NextResponse.json(
        { error: verified.reason || "Invalid code." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await withWriteLock(() =>
      db.user.update({
        where: { id: auth.user.id },
        data: { password: passwordHash },
      })
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Could not update password." },
      { status: 500 }
    );
  }
}
