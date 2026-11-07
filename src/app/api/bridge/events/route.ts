import { connection, NextResponse } from "next/server";
import { listBridgeEvents, verifyBridgeRequest } from "@sezsec/bridge";

export async function GET(request: Request) {
  await connection();
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const rawTypes = searchParams.get("types");
  const rawIds = searchParams.get("ids");
  const limitRaw = searchParams.get("limit");

  const events = await listBridgeEvents({
    types: rawTypes
      ? rawTypes
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : undefined,
    ids: rawIds
      ? rawIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
    excludeCancelled: searchParams.get("excludeCancelled") === "true",
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    hasMenu: searchParams.get("hasMenu") === "true",
    limit: limitRaw ? parseInt(limitRaw, 10) : undefined,
    order: searchParams.get("order") === "desc" ? "desc" : "asc",
  });

  return NextResponse.json({ events });
}
