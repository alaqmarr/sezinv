import { connection, NextResponse, type NextRequest } from "next/server";
import { getEventById } from "@sezsec/events/events.service";
import { listEventActivity } from "@sezsec/logs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connection();
  const { id } = await context.params;

  // Always pass amountsUnlocked = false on public endpoint so rupee amounts are NEVER exposed publicly
  const [event, logs] = await Promise.all([
    getEventById(id, false),
    listEventActivity(id),
  ]);

  if (!event) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  return NextResponse.json({ event, logs });
}
