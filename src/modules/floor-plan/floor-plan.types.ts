export interface FloorCanvasItem {
  id: string;
  label: string;
  shape: "circle" | "rectangle";
  widthFt: number;
  lengthFt: number;
  xFt: number;
  yFt: number;
  rotation: number;
  color: string;
}

export interface FloorPlanRecord {
  id: string;
  name: string;
  hallId: string;
  hallName: string;
  width: number;
  length: number;
  items: FloorCanvasItem[];
  isPublic: boolean;
  publicToken: string | null;
  updatedAt: string;
}
