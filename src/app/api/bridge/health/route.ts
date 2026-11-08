import { connection, NextResponse } from "next/server";
import { verifyBridgeRequest } from "@sezsec/bridge";
import { db } from "@sezsec/db";

export async function GET(request: Request) {
  await connection();
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  const [eventsCount, hallsCount, inventoryCount] = await Promise.all([
    db.event.count(),
    db.hall.count(),
    db.inventoryItem.count(),
  ]);

  return NextResponse.json({
    ok: true,
    service: "sezinv-jamatevents",
    port: 3333,
    eventsCount,
    hallsCount,
    inventoryCount,
    timestamp: new Date().toISOString(),
  });
}
