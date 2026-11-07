export type DepositStatus = "NONE" | "HELD" | "REFUNDED";

export interface EventAmountFields {
  thaalRate: number;
  thaalAmount: number;
  sarkariRate: number;
  sarkariAmount: number;
  kitchenCharge: number;
  decorationCharge: number;
  otherCharge: number;
  hallCharges: Record<string, number>;
  totalAmount: number;
  depositAmount: number;
  depositStatus: DepositStatus;
  amountNotes: string | null;
}

export interface RedactedAmountFields {
  thaalRate: number | null;
  thaalAmount: number | null;
  sarkariRate: number | null;
  sarkariAmount: number | null;
  kitchenCharge: number | null;
  decorationCharge: number | null;
  otherCharge: number | null;
  hallCharges: Record<string, number> | null;
  totalAmount: number | null;
  depositAmount: number | null;
  depositStatus: DepositStatus;
  amountNotes: string | null;
  amountsLocked: boolean;
}
