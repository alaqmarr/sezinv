import type {
  DepositStatus,
  EventAmountFields,
  RedactedAmountFields,
} from "./finance.types";

export function normalizeHallCharges(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const num = Math.max(0, Math.round(Number(v) || 0));
    if (k.trim()) {
      result[k.trim()] = num;
    }
  }
  return result;
}

export function calculateEventAmounts(input: {
  thaalCount: number;
  sarkariThaalSet: number;
  thaalRate?: number;
  thaalAmount?: number;
  sarkariRate?: number;
  sarkariAmount?: number;
  kitchenCharge?: number;
  decorationCharge?: number;
  otherCharge?: number;
  hallCharges?: Record<string, number> | null;
  depositAmount?: number;
  depositStatus?: string | null;
  amountNotes?: string | null;
}): EventAmountFields {
  const thaalRate = Math.max(0, Math.round(Number(input.thaalRate) || 0));
  const thaalAmount =
    thaalRate > 0 && input.thaalCount > 0
      ? thaalRate * input.thaalCount
      : Math.max(0, Math.round(Number(input.thaalAmount) || 0));

  const sarkariRate = Math.max(0, Math.round(Number(input.sarkariRate) || 0));
  const sarkariAmount =
    sarkariRate > 0 && input.sarkariThaalSet > 0
      ? sarkariRate * input.sarkariThaalSet
      : Math.max(0, Math.round(Number(input.sarkariAmount) || 0));

  const kitchenCharge = Math.max(0, Math.round(Number(input.kitchenCharge) || 0));
  const decorationCharge = Math.max(
    0,
    Math.round(Number(input.decorationCharge) || 0)
  );
  const otherCharge = Math.max(0, Math.round(Number(input.otherCharge) || 0));
  const hallCharges = normalizeHallCharges(input.hallCharges);

  const hallTotal = Object.values(hallCharges).reduce((sum, val) => sum + val, 0);
  const totalAmount =
    thaalAmount +
    sarkariAmount +
    kitchenCharge +
    decorationCharge +
    otherCharge +
    hallTotal;

  const depositAmount = Math.max(0, Math.round(Number(input.depositAmount) || 0));
  const rawDepositStatus = (input.depositStatus || "").toUpperCase();
  const depositStatus: DepositStatus =
    rawDepositStatus === "REFUNDED"
      ? "REFUNDED"
      : depositAmount > 0
        ? "HELD"
        : "NONE";

  return {
    thaalRate,
    thaalAmount,
    sarkariRate,
    sarkariAmount,
    kitchenCharge,
    decorationCharge,
    otherCharge,
    hallCharges,
    totalAmount,
    depositAmount,
    depositStatus,
    amountNotes: input.amountNotes?.trim() || null,
  };
}

export function applyAmountRedaction<
  T extends {
    thaalRate: number;
    thaalAmount: number;
    sarkariRate: number;
    sarkariAmount: number;
    kitchenCharge: number;
    decorationCharge: number;
    otherCharge: number;
    hallCharges: unknown;
    totalAmount: number;
    depositAmount: number;
    depositStatus: string;
    amountNotes: string | null;
  },
>(
  event: T,
  unlocked: boolean
): Omit<
  T,
  | "thaalRate"
  | "thaalAmount"
  | "sarkariRate"
  | "sarkariAmount"
  | "kitchenCharge"
  | "decorationCharge"
  | "otherCharge"
  | "hallCharges"
  | "totalAmount"
  | "depositAmount"
  | "depositStatus"
  | "amountNotes"
> &
  RedactedAmountFields {
  const depositStatus: DepositStatus =
    event.depositStatus === "REFUNDED"
      ? "REFUNDED"
      : event.depositStatus === "HELD"
        ? "HELD"
        : "NONE";

  if (!unlocked) {
    return {
      ...event,
      thaalRate: null,
      thaalAmount: null,
      sarkariRate: null,
      sarkariAmount: null,
      kitchenCharge: null,
      decorationCharge: null,
      otherCharge: null,
      hallCharges: null,
      totalAmount: null,
      depositAmount: null,
      depositStatus,
      amountNotes: null,
      amountsLocked: true,
    };
  }

  return {
    ...event,
    hallCharges: normalizeHallCharges(event.hallCharges),
    depositStatus,
    amountsLocked: false,
  };
}
