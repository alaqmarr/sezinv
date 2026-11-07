import type { DepositStatus } from "@sezsec/finance/finance.types";

export type EventStatusType = "BOOKED" | "CANCELLED" | "COMPLETED";
export type EventVisibilityType = "PUBLIC" | "PRIVATE";
export type CrockeryStatusType = "PENDING" | "NOT_REQUIRED" | "COMPLETED";

export interface EventAllocationSummary {
  id: string;
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  issuedQty: number;
  returnedQty: number;
  lostQty: number;
  recoveredQty: number;
}

export interface PortalEvent {
  id: string;
  reference: string | null;
  name: string;
  mobile: string;
  email: string | null;
  occasionDate: string; // ISO string
  occasionDay: string | null;
  occasionTime: string;
  description: string;
  halls: string[];
  hallCounts: Record<string, number>;

  catererName: string;
  catererPhone: string;
  catererId: string | null;

  decoratorName: string | null;
  decoratorPhone: string | null;
  decoratorId: string | null;

  thaalCount: number;
  totalThaalsDone: number | null;
  sarkariThaalSet: number;
  bhaiSaabIzzan: boolean;
  muraqebeenIzzan: boolean;
  benSaabIzzan: boolean;
  extraChilamchiLota: number;
  tablesAndChairs: number;
  mic: boolean;
  crockeryRequired: boolean;
  thaalForDevri: boolean;
  paat: boolean;
  masjidLight: boolean;
  crockeryStatus: CrockeryStatusType;

  acStartTime: string | null;
  partyTime: string | null;
  decorations: boolean;
  gasCount: number | null;
  menu: string | null;

  status: EventStatusType;
  eventType: EventVisibilityType;
  razaGranted: boolean;
  paymentMode: string | null;
  transactionId: string | null;
  refundedDate: string | null;

  // Decrypted amounts (redacted to null on read until Email OTP is verified)
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

  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  createdByName?: string | null;
  allocations?: EventAllocationSummary[];
}

export interface HallConflictWarning {
  eventId: string;
  bookerName: string;
  description: string;
  occasionTime: string;
  overlappingHalls: string[];
}
