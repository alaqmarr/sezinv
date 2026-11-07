import { connection, NextResponse } from "next/server";
import { listBridgeInventory, verifyBridgeRequest } from "@sezsec/bridge";

export async function GET(request: Request) {
  await connection();
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  const items = await listBridgeInventory();
  return NextResponse.json({ items });
}
