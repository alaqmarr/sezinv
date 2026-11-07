import { connection, NextResponse } from "next/server";
import { requireApiAuth } from "@sezsec/rbac/rbac.server";
import {
  inspectNeonVsSqliteCounts,
  runOneClickNeonToSqliteMigration,
} from "@sezsec/migration/neon-sync.service";

export async function GET() {
  await connection();
  const auth = await requireApiAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const report = await inspectNeonVsSqliteCounts();
  return NextResponse.json(report);
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const customNeonUrl = body?.neonUrl ? String(body.neonUrl).trim() : undefined;

    const result = await runOneClickNeonToSqliteMigration({
      actor: {
        id: auth.user.id,
        name: auth.user.name || auth.user.username,
      },
      customNeonUrl,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[SEZSEC Migration Error]", err);
    const msg =
      err instanceof Error ? err.message : "Could not complete data migration.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
