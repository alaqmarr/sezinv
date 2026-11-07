import { NextResponse } from "next/server";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import {
  deleteStoreItem,
  updateStoreItem,
} from "@sezsec/inventory/inventory.service";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth([
    "ADMIN",
    "ADMIN_CUSTOM",
    "MANAGER",
    "STAFF",
  ]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const updated = await updateStoreItem(id, body || {}, {
      id: auth.user.id,
      name: auth.user.name || auth.user.username,
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not update store item.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await deleteStoreItem(id, {
      id: auth.user.id,
      name: auth.user.name || auth.user.username,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not remove store item.";
    return NextResponse.json({ error: msg }, { status: 409 });
  }
}
