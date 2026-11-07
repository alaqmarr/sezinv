import { connection, NextResponse, type NextRequest } from "next/server";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import { lookupBookersByMobile } from "@sezsec/events/events.service";

export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const q = request.nextUrl.searchParams.get("mobile") || "";
  const results = await lookupBookersByMobile(q);
  return NextResponse.json({ results });
}
