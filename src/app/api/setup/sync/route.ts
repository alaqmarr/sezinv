import { NextResponse } from "next/server";
import { syncAccountsOrInitialDataFromNeon } from "@sezsec/migration/neon-sync.service";

export async function POST() {
  try {
    const result = await syncAccountsOrInitialDataFromNeon();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[SEZSEC Sync Error]", err);
    const msg =
      err instanceof Error
        ? err.message
        : "Could not sync records from the previous database.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
