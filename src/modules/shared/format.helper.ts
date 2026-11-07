export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatRupees(amount: number | null | undefined, withSymbol = true): string {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) return withSymbol ? "₹0" : "0";
  const formatted = Math.round(num).toLocaleString("en-IN");
  return withSymbol ? `₹${formatted}` : formatted;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "your registered email";
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0] ?? "*"}***@${domain}`;
  }
  return `${local.slice(0, 2)}${"*".repeat(Math.min(5, local.length - 2))}@${domain}`;
}

export function normalizeHallList(hallValue: unknown): string[] {
  if (Array.isArray(hallValue)) {
    return hallValue.map((h) => String(h).trim()).filter(Boolean);
  }
  if (typeof hallValue === "string") {
    const trimmed = hallValue.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((h) => String(h).trim()).filter(Boolean);
        }
      } catch {
        // Treat as single hall name
      }
    }
    return [trimmed];
  }
  return [];
}

const SELF_VENUE_TOKENS = new Set([
  "self",
  "own",
  "house",
  "home",
  "others",
  "other",
  "na",
  "n/a",
  "none",
  "outside",
]);

/**
 * Returns true if the booking is a Self / Home / Outside event rather than at a Jamaat hall.
 * Used to determine hall conflict checks and whether Decorator Details are required when
 * Decorations is selected ("if decorations is selected and event is not self").
 */
export function isSelfEventVenue(halls: unknown): boolean {
  const list = normalizeHallList(halls);
  if (list.length === 0) return true;
  return list.every((h) => SELF_VENUE_TOKENS.has(h.toLowerCase().trim()));
}

export function isIgnoredConflictHall(hallName: string): boolean {
  return SELF_VENUE_TOKENS.has(hallName.toLowerCase().trim());
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  ADMIN_CUSTOM: "Custom Administrator",
  MANAGER: "Office Manager",
  STAFF: "Store & Hall Staff",
  WATCHER: "View-Only Member",
  USER: "Member",
};
