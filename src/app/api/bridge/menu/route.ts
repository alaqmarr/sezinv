import { connection, NextResponse } from "next/server";
import { getBridgeMenuEvent, verifyBridgeRequest } from "@sezsec/bridge";

export async function GET(request: Request) {
  await connection();
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "today" ? "today" : "upcoming";
  const event = await getBridgeMenuEvent(mode);

  return NextResponse.json({ event });
}
