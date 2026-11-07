import { NextResponse, type NextRequest } from "next/server";
import { db, withWriteLock } from "@sezsec/db";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

export async function POST(request: Request) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    if (!name) {
      return NextResponse.json(
        { error: "Please enter the hall name." },
        { status: 400 }
      );
    }

    const hall = await withWriteLock(() =>
      db.hall.upsert({
        where: { name },
        update: {
          width: body?.width ? Number(body.width) : null,
          length: body?.length ? Number(body.length) : null,
        },
        create: {
          name,
          width: body?.width ? Number(body.width) : null,
          length: body?.length ? Number(body.length) : null,
        },
      })
    );

    return NextResponse.json({ ok: true, hall });
  } catch {
    return NextResponse.json(
      { error: "Could not save hall." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing hall ID." }, { status: 400 });
  }

  await withWriteLock(() => db.hall.delete({ where: { id } }));
  return NextResponse.json({ ok: true });
}
