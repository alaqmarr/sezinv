import { connection, NextResponse } from "next/server";
import {
  deleteBridgeEvent,
  getBridgeEventById,
  updateBridgeEventThaalsDone,
  verifyBridgeRequest,
} from "@sezsec/bridge";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  await connection();
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const event = await getBridgeEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  return NextResponse.json({ event });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();

    const updated = await updateBridgeEventThaalsDone(id, {
      hallCounts: body?.hallCounts,
      totalOverride: body?.totalOverride,
      actorId: body?.actorId ? String(body.actorId) : undefined,
      actorName: body?.actorName ? String(body.actorName) : undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, event: updated });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not update thaal count.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = verifyBridgeRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const deleted = await deleteBridgeEvent(id, {
    id: body?.actorId ? String(body.actorId) : undefined,
    name: body?.actorName ? String(body.actorName) : undefined,
  });

  if (!deleted) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
