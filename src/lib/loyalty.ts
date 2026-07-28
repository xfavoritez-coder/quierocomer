import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertOwnsRestaurant } from "@/lib/adminAuth";

export interface RewardTier {
  stamp: number;
  reward: string;
}

/** Convierte el campo JSON `rewards` en una lista tipada y ordenada de niveles. */
export function parseRewards(raw: unknown): RewardTier[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is RewardTier => !!t && typeof t === "object" && typeof (t as any).stamp === "number" && typeof (t as any).reward === "string")
    .map((t) => ({ stamp: t.stamp, reward: t.reward }))
    .sort((a, b) => a.stamp - b.stamp);
}

/**
 * Devuelve el programa de fidelidad del restaurante, creándolo con valores
 * por defecto si aún no existe. Garantiza que siempre haya un programId
 * al que asociar miembros.
 */
export async function ensureProgram(restaurantId: string) {
  return prisma.loyaltyProgram.upsert({
    where: { restaurantId },
    create: { restaurantId },
    update: {},
  });
}

/**
 * Carga un miembro por id y verifica que el usuario autenticado sea dueño
 * (o admin) del restaurante al que pertenece. Lanza error con .status si no.
 */
export async function getMemberForOwner(req: NextRequest, memberId: string) {
  const member = await prisma.loyaltyMember.findUnique({
    where: { id: memberId },
    include: { program: true },
  });
  if (!member) {
    const err: any = new Error("Miembro no encontrado");
    err.status = 404;
    throw err;
  }
  await assertOwnsRestaurant(req, member.restaurantId);
  return member;
}
