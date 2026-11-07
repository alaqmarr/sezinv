import { NextResponse, type NextRequest } from "next/server";
import { db, withWriteLock } from "@sezsec/db";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";

export async function POST(request: Request) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const phone = String(body?.phone || "").trim();
    if (!name || !phone) {
      return NextResponse.json(
        { error: "Please enter both caterer name and phone number." },
        { status: 400 }
      );
    }

    const caterer = await withWriteLock(() =>
      db.caterer.upsert({
        where: { name },
        update: { phone },
        create: { name, phone },
      })
    );

    return NextResponse.json({ ok: true, caterer });
  } catch {
    return NextResponse.json(
      { error: "Could not save caterer." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing caterer ID." }, { status: 400 });
  }

  await withWriteLock(() => db.caterer.delete({ where: { id } }));
  return NextResponse.json({ ok: true });
}
