import { connection, NextResponse } from "next/server";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import {
  listFloorPlans,
  saveFloorPlanRecord,
} from "@sezsec/floor-plan/floor-plan.service";

export async function GET() {
  await connection();
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const plans = await listFloorPlans();
  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["ADMIN", "ADMIN_CUSTOM", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body?.name?.trim() || !body?.hallId) {
      return NextResponse.json(
        { error: "Please enter a layout name and choose a hall." },
        { status: 400 }
      );
    }

    const plan = await saveFloorPlanRecord({
      id: body.id ? String(body.id) : undefined,
      name: String(body.name),
      hallId: String(body.hallId),
      width: Number(body.width || 50),
      length: Number(body.length || 70),
      items: Array.isArray(body.items) ? body.items : [],
      isPublic: Boolean(body.isPublic),
    });

    return NextResponse.json({ ok: true, plan });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not save floor layout.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
