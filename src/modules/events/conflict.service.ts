import { db } from "@sezsec/db";
import {
  formatTimeDisplay,
  getISTDayBounds,
  isIgnoredConflictHall,
  normalizeHallList,
  parseTimeToMinutes,
} from "@sezsec/shared";
import type { HallConflictWarning } from "./events.types";

const BASE_EVENT_DURATION_MINUTES = 180; // 3 hours standard occasion block

export async function getBookingGapMinutes(): Promise<number> {
  const row = await db.config.findUnique({
    where: { key: "bookingWindow" },
  });
  const parsed = Number(row?.value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 120;
}

export async function checkHallConflicts(params: {
  occasionDate: string | Date;
  occasionTime: string;
  halls: string[];
  excludeEventId?: string;
}): Promise<{
  hasConflict: boolean;
  gapMinutes: number;
  conflicts: HallConflictWarning[];
}> {
  const requestedHalls = params.halls
    .map((h) => h.trim())
    .filter((h) => h && !isIgnoredConflictHall(h));

  const gapMinutes = await getBookingGapMinutes();

  if (requestedHalls.length === 0) {
    return { hasConflict: false, gapMinutes, conflicts: [] };
  }

  const { startOfDay, endOfDay } = getISTDayBounds(params.occasionDate);
  const sameDayEvents = await db.event.findMany({
    where: {
      occasionDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: {
        not: "CANCELLED",
      },
      ...(params.excludeEventId
        ? { id: { not: params.excludeEventId } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      occasionTime: true,
      hall: true,
    },
  });

  const targetStart = parseTimeToMinutes(params.occasionTime);
  const targetEnd = targetStart + BASE_EVENT_DURATION_MINUTES + gapMinutes;
  const requestedLower = new Set(requestedHalls.map((h) => h.toLowerCase()));

  const conflicts: HallConflictWarning[] = [];

  for (const existing of sameDayEvents) {
    const existingHalls = normalizeHallList(existing.hall).filter(
      (h) => !isIgnoredConflictHall(h)
    );
    const overlappingHalls = existingHalls.filter((h) =>
      requestedLower.has(h.toLowerCase())
    );

    if (overlappingHalls.length === 0) continue;

    const existingStart = parseTimeToMinutes(existing.occasionTime);
    const existingEnd = existingStart + BASE_EVENT_DURATION_MINUTES + gapMinutes;

    const overlaps = targetStart < existingEnd && existingStart < targetEnd;
    if (overlaps) {
      conflicts.push({
        eventId: existing.id,
        bookerName: existing.name,
        description: existing.description,
        occasionTime: existing.occasionTime
          ? formatTimeDisplay(existing.occasionTime)
          : existing.occasionTime,
        overlappingHalls,
      });
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    gapMinutes,
    conflicts,
  };
}
