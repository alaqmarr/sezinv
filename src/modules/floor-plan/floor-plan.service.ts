import crypto from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db, withWriteTransaction } from "@sezsec/db";
import type { FloorCanvasItem, FloorPlanRecord } from "./floor-plan.types";

function parseFloorItems(raw: unknown): FloorCanvasItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, idx) => ({
    id: String(item?.id || `item-${idx}`),
    label: String(item?.label || item?.name || "Thaal"),
    shape: item?.shape === "rectangle" || item?.type === "rectangle" ? "rectangle" : "circle",
    widthFt: Number(item?.widthFt ?? item?.width ?? 5),
    lengthFt: Number(item?.lengthFt ?? item?.length ?? 5),
    xFt: Number(item?.xFt ?? item?.x ?? 4),
    yFt: Number(item?.yFt ?? item?.y ?? 4),
    rotation: Number(item?.rotation ?? 0),
    color: String(item?.color || "#6A1B1B"),
  }));
}

export async function listFloorPlans(): Promise<FloorPlanRecord[]> {
  const rows = await db.floorPlan.findMany({
    include: { hall: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    hallId: r.hallId,
    hallName: r.hall.name,
    width: r.width,
    length: r.length,
    items: parseFloorItems(r.data),
    isPublic: r.isPublic,
    publicToken: r.publicToken,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getPublicFloorPlanByToken(
  token: string
): Promise<FloorPlanRecord | null> {
  const row = await db.floorPlan.findUnique({
    where: { publicToken: token },
    include: { hall: { select: { name: true } } },
  });
  if (!row || !row.isPublic) return null;

  return {
    id: row.id,
    name: row.name,
    hallId: row.hallId,
    hallName: row.hall.name,
    width: row.width,
    length: row.length,
    items: parseFloorItems(row.data),
    isPublic: row.isPublic,
    publicToken: row.publicToken,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveFloorPlanRecord(input: {
  id?: string;
  name: string;
  hallId: string;
  width: number;
  length: number;
  items: FloorCanvasItem[];
  isPublic: boolean;
}): Promise<FloorPlanRecord> {
  const saved = await withWriteTransaction(async (tx) => {
    const existing = input.id
      ? await tx.floorPlan.findUnique({ where: { id: input.id } })
      : null;

    const publicToken = input.isPublic
      ? existing?.publicToken || crypto.randomBytes(18).toString("base64url")
      : null;

    if (existing) {
      return tx.floorPlan.update({
        where: { id: existing.id },
        data: {
          name: input.name.trim(),
          hallId: input.hallId,
          width: input.width,
          length: input.length,
          data: input.items as unknown as Prisma.InputJsonValue,
          isPublic: input.isPublic,
          publicToken,
        },
        include: { hall: { select: { name: true } } },
      });
    }

    return tx.floorPlan.create({
      data: {
        name: input.name.trim(),
        hallId: input.hallId,
        width: input.width,
        length: input.length,
        data: input.items as unknown as Prisma.InputJsonValue,
        isPublic: input.isPublic,
        publicToken,
      },
      include: { hall: { select: { name: true } } },
    });
  });

  return {
    id: saved.id,
    name: saved.name,
    hallId: saved.hallId,
    hallName: saved.hall.name,
    width: saved.width,
    length: saved.length,
    items: parseFloorItems(saved.data),
    isPublic: saved.isPublic,
    publicToken: saved.publicToken,
    updatedAt: saved.updatedAt.toISOString(),
  };
}
