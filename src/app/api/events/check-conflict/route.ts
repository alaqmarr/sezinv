import { NextResponse } from "next/server";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import { checkHallConflicts } from "@sezsec/events/conflict.service";

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const result = await checkHallConflicts({
      occasionDate: String(body?.occasionDate || ""),
      occasionTime: String(body?.occasionTime || "12:00 PM"),
      halls: Array.isArray(body?.halls) ? body.halls.map(String) : [],
      excludeEventId: body?.excludeEventId ? String(body.excludeEventId) : undefined,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { hasConflict: false, gapMinutes: 120, conflicts: [] },
      { status: 200 }
    );
  }
}
