import { connection, NextResponse } from "next/server";
import type { AppRole } from "@sezsec/shared";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import {
  createTeamMember,
  listTeamMembers,
} from "@sezsec/users/users.service";

export async function GET() {
  await connection();
  const auth = await requireApiAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const users = await listTeamMembers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body?.username?.trim() || !body?.password || String(body.password).length < 6) {
      return NextResponse.json(
        { error: "Username and a password of at least 6 characters are required." },
        { status: 400 }
      );
    }

    const created = await createTeamMember(
      {
        username: String(body.username),
        password: String(body.password),
        name: String(body.name || ""),
        email: body.email ? String(body.email) : undefined,
        mobile: body.mobile ? String(body.mobile) : undefined,
        its: body.its ? String(body.its) : undefined,
        role: (body.role || "STAFF") as AppRole,
        moduleIds: Array.isArray(body.moduleIds) ? body.moduleIds.map(String) : undefined,
      },
      {
        id: auth.user.id,
        name: auth.user.name || auth.user.username,
      }
    );

    return NextResponse.json({ ok: true, user: created }, { status: 201 });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not add team member.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
