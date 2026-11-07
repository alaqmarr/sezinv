import { NextResponse } from "next/server";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import { resolveMissingItem } from "@sezsec/inventory/inventory.service";

export async function POST(request: Request) {
  const auth = await requireApiAuth([
    "ADMIN",
    "ADMIN_CUSTOM",
    "MANAGER",
    "STAFF",
  ]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    await resolveMissingItem({
      allocationId: String(body?.allocationId || ""),
      quantity: Number(body?.quantity || 1),
      mode: body?.mode === "WRITE_OFF" ? "WRITE_OFF" : "RECOVER",
      actor: {
        id: auth.user.id,
        name: auth.user.name || auth.user.username,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not update missing item.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
