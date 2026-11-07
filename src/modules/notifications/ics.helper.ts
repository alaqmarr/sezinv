import { parseISTEventDateTime } from "@sezsec/shared";

export function generateEventIcs(event: {
  id: string;
  name: string;
  description: string;
  occasionDate: Date | string;
  occasionTime: string;
  halls: string[];
}): string {
  const start = parseISTEventDateTime(event.occasionDate, event.occasionTime);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

  const toIcsUtc = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");

  const location = event.halls.join(", ") || "Anjuman-e-Mohammedi, Secunderabad";
  const summary = `${event.description} - ${event.name}`.replace(/[\r\n]+/g, " ");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SEZSEC//Jamaat Events Secunderabad//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@sezsec.local`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:Booked by ${event.name} at ${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
