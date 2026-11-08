import { NextResponse } from "next/server";
import {
  getBridgeBootstrapCounts,
  getBridgeBootstrapSnapshot,
  verifyBridgeRequest,
} from "@sezsec/bridge";

/**
 * Internal loopback endpoint (/api/bridge/bootstrap) on sezinv (:3333)
 * allowing sezsecnew (:3334) to sanction and synchronize shared member, RBAC,
 * finance, floor, attendance, and community portal data directly from the
 * Inventory App's SQLite WAL database (with zero Neon dependency).
 */
export async function GET(request: Request) {
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode");

    if (mode === "counts") {
      const counts = await getBridgeBootstrapCounts();
      return NextResponse.json({
        ok: true,
        source: "sezinv-loopback-bridge",
        counts,
      });
    }

    const snapshot = await getBridgeBootstrapSnapshot();
    return NextResponse.json({
      ok: true,
      source: "sezinv-loopback-bridge",
      snapshot,
    });
  } catch (err) {
    console.error("[api/bridge/bootstrap] Error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to export portal bootstrap snapshot from Inventory App.",
      },
      { status: 500 }
    );
  }
}
