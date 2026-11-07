import { NextResponse } from "next/server";
import type { AppRole } from "@sezsec/shared";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import {
  deleteTeamMember,
  updateTeamMember,
} from "@sezsec/users/users.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();

    await updateTeamMember(
      id,
      {
        name: body?.name,
        email: body?.email,
        mobile: body?.mobile,
        its: body?.its,
        role: body?.role as AppRole | undefined,
        newPassword: body?.newPassword,
        moduleIds: Array.isArray(body?.moduleIds)
          ? body.moduleIds.map(String)
          : undefined,
      },
      {
        id: auth.user.id,
        name: auth.user.name || auth.user.username,
      }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not update team member.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await deleteTeamMember(id, {
      id: auth.user.id,
      name: auth.user.name || auth.user.username,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not remove team member.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
