export interface StoreItem {
  id: string;
  name: string;
  category: string;
  totalQuantity: number;
  availableQuantity: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export type EventInventoryAction =
  | "ISSUE"
  | "RETURN"
  | "LOSS"
  | "ADJUST_ISSUED"
  | "ADJUST_RETURNED";

export interface MissingItemRecord {
  allocationId: string;
  eventId: string;
  eventName: string;
  eventDescription: string;
  occasionDate: string;
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  lostQty: number;
  recoveredQty: number;
  remainingMissing: number;
  updatedAt: string;
}
