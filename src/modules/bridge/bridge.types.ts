export interface BridgeEventDto {
  id: string;
  reference: string | null;
  name: string;
  mobile: string;
  email: string | null;
  occasionDate: string;
  occasionDay: string | null;
  occasionTime: string;
  description: string;
  hall: string[];
  catererName: string;
  catererPhone: string;
  decoratorName: string | null;
  decoratorPhone: string | null;
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
  crockeryStatus: string;
  acStartTime: string | null;
  partyTime: string | null;
  decorations: boolean;
  gasCount: number | null;
  menu: string | null;
  status: string;
  eventType: string;
  hallCounts: Record<string, number> | null;
  razaGranted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BridgeHallDto {
  id: string;
  name: string;
  width: number | null;
  length: number | null;
}

export interface BridgeInventoryItemDto {
  id: string;
  name: string;
  category: string;
  totalQuantity: number;
  availableQuantity: number;
  unit: string;
}
