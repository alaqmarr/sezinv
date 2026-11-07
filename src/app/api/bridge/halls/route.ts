import { connection, NextResponse } from "next/server";
import { listBridgeHalls, verifyBridgeRequest } from "@sezsec/bridge";

export async function GET(request: Request) {
  await connection();
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  const halls = await listBridgeHalls();
  return NextResponse.json({ halls });
}
