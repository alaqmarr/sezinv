import { connection, NextResponse } from "next/server";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import {
  bulkCreateStoreItems,
  createStoreItem,
  listStoreItems,
} from "@sezsec/inventory/inventory.service";

export async function GET() {
  await connection();
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const items = await listStoreItems();
  return NextResponse.json({ items });
}

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
    const actor = {
      id: auth.user.id,
      name: auth.user.name || auth.user.username,
    };

    if (Array.isArray(body?.items)) {
      const count = await bulkCreateStoreItems(body.items, actor);
      return NextResponse.json({ ok: true, count });
    }

    if (!body?.name?.trim()) {
      return NextResponse.json(
        { error: "Please enter the item name." },
        { status: 400 }
      );
    }

    const item = await createStoreItem(
      {
        name: String(body.name),
        category: String(body.category || "General"),
        totalQuantity: Number(body.totalQuantity || 0),
        unit: String(body.unit || "pcs"),
      },
      actor
    );

    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not add store item.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
