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
        { error: "Please enter both decorator name and phone number." },
        { status: 400 }
      );
    }

    const decorator = await withWriteLock(() =>
      db.decorator.upsert({
        where: { name },
        update: { phone },
        create: { name, phone },
      })
    );

    return NextResponse.json({ ok: true, decorator });
  } catch {
    return NextResponse.json(
      { error: "Could not save decorator." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Missing decorator ID." },
      { status: 400 }
    );
  }

  await withWriteLock(() => db.decorator.delete({ where: { id } }));
  return NextResponse.json({ ok: true });
}
