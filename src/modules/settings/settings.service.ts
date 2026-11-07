import { db, withWriteTransaction } from "@sezsec/db";
import { getAdminSmtpSettingsSummary } from "@sezsec/notifications/smtp-config.helper";
import {
  DEFAULT_BOOKING_GUIDELINES,
  type BookingGuidelinesConfig,
} from "@sezsec/print/dos-and-donts.constants";
import type { PortalMasterSettings } from "./settings.types";

const GUIDELINES_CONFIG_KEY = "bookingGuidelinesJson";
const BOOKING_WINDOW_KEY = "bookingWindow";

const DEFAULT_STARTER_HALLS = [
  { name: "Main Jamaat Khana Hall", width: 60, length: 90 },
  { name: "Ground Floor Dining Hall", width: 45, length: 75 },
  { name: "First Floor Hall", width: 45, length: 70 },
  { name: "Open Sahan / Courtyard", width: 50, length: 60 },
];

export async function ensureStarterVenuesIfEmpty(): Promise<void> {
  if (process.env.NEON_DATABASE_URL?.trim()) return;

  const hallCount = await db.hall.count();
  const eventCount = await db.event.count();
  if (hallCount > 0 || eventCount > 0) return;

  await withWriteTransaction(async (tx) => {
    const checkAgain = await tx.hall.count();
    if (checkAgain > 0) return;
    for (const h of DEFAULT_STARTER_HALLS) {
      await tx.hall.create({ data: h });
    }
  });
}

export async function getBookingGuidelines(): Promise<BookingGuidelinesConfig> {
  const row = await db.config.findUnique({
    where: { key: GUIDELINES_CONFIG_KEY },
  });
  if (!row?.value) return DEFAULT_BOOKING_GUIDELINES;

  try {
    const parsed = JSON.parse(row.value) as Partial<BookingGuidelinesConfig>;
    return {
      dos:
        Array.isArray(parsed.dos) && parsed.dos.length > 0
          ? parsed.dos.map((s) => String(s).trim()).filter(Boolean)
          : DEFAULT_BOOKING_GUIDELINES.dos,
      donts:
        Array.isArray(parsed.donts) && parsed.donts.length > 0
          ? parsed.donts.map((s) => String(s).trim()).filter(Boolean)
          : DEFAULT_BOOKING_GUIDELINES.donts,
      footerNote:
        typeof parsed.footerNote === "string"
          ? parsed.footerNote
          : DEFAULT_BOOKING_GUIDELINES.footerNote,
    };
  } catch {
    return DEFAULT_BOOKING_GUIDELINES;
  }
}

export async function saveBookingGuidelines(
  guidelines: BookingGuidelinesConfig
): Promise<BookingGuidelinesConfig> {
  const cleaned: BookingGuidelinesConfig = {
    dos: guidelines.dos.map((s) => s.trim()).filter(Boolean),
    donts: guidelines.donts.map((s) => s.trim()).filter(Boolean),
    footerNote: guidelines.footerNote.trim(),
  };

  await withWriteTransaction((tx) =>
    tx.config.upsert({
      where: { key: GUIDELINES_CONFIG_KEY },
      update: { value: JSON.stringify(cleaned) },
      create: { key: GUIDELINES_CONFIG_KEY, value: JSON.stringify(cleaned) },
    })
  );

  return cleaned;
}

export async function saveBookingWindowMinutes(minutes: number): Promise<number> {
  const safeMinutes = Math.max(0, Math.min(720, Math.round(minutes)));
  await withWriteTransaction((tx) =>
    tx.config.upsert({
      where: { key: BOOKING_WINDOW_KEY },
      update: { value: String(safeMinutes) },
      create: { key: BOOKING_WINDOW_KEY, value: String(safeMinutes) },
    })
  );
  return safeMinutes;
}

export async function getPortalMasterSettings(): Promise<PortalMasterSettings> {
  const [windowRow, guidelines, halls, caterers, decorators, emailSettings] =
    await Promise.all([
      db.config.findUnique({ where: { key: BOOKING_WINDOW_KEY } }),
      getBookingGuidelines(),
      db.hall.findMany({ orderBy: { name: "asc" } }),
      db.caterer.findMany({ orderBy: { name: "asc" } }),
      db.decorator.findMany({ orderBy: { name: "asc" } }),
      getAdminSmtpSettingsSummary(),
    ]);

  const parsedWindow = Number(windowRow?.value);
  const bookingWindowMinutes =
    Number.isFinite(parsedWindow) && parsedWindow >= 0 ? parsedWindow : 120;

  return {
    bookingWindowMinutes,
    guidelines,
    halls,
    caterers,
    decorators,
    emailSettings,
  };
}
