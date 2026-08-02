import { prisma } from "@/lib/prisma";

export type MemberFilter =
  | "all"
  | "birthday_today"
  | "birthday_week"
  | "loyal"
  | "active"
  | "inactive"
  | "no_stamps";

export const FILTER_LABELS: Record<MemberFilter, string> = {
  all: "Todos los miembros",
  birthday_today: "Cumpleaños hoy",
  birthday_week: "Cumpleaños esta semana",
  loyal: "Clientes frecuentes",
  active: "Activos (últimos 30 días)",
  inactive: "Inactivos (más de 30 días)",
  no_stamps: "Sin sellos aún",
};

/**
 * Devuelve los IDs de los miembros que cumplen el filtro dado.
 * Excluye siempre los revocados.
 */
export async function getFilteredMemberIds(
  restaurantId: string,
  filter: MemberFilter,
): Promise<string[]> {
  const base = { restaurantId, revoked: false };

  if (filter === "birthday_today") {
    const today = new Date();
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "LoyaltyMember"
      WHERE "restaurantId" = ${restaurantId}
        AND "revoked" = false
        AND "birthDate" IS NOT NULL
        AND EXTRACT(MONTH FROM "birthDate") = ${today.getMonth() + 1}
        AND EXTRACT(DAY   FROM "birthDate") = ${today.getDate()}
    `;
    return rows.map((r) => r.id);
  }

  if (filter === "birthday_week") {
    // Genera los 7 pares (mes, día) de hoy a hoy+6
    const pairs: { month: number; day: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      pairs.push({ month: d.getMonth() + 1, day: d.getDate() });
    }
    // Construye un WHERE con OR sobre cada par
    const conditions = pairs
      .map((p) => `(EXTRACT(MONTH FROM "birthDate") = ${p.month} AND EXTRACT(DAY FROM "birthDate") = ${p.day})`)
      .join(" OR ");

    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(`
      SELECT id FROM "LoyaltyMember"
      WHERE "restaurantId" = '${restaurantId}'
        AND "revoked" = false
        AND "birthDate" IS NOT NULL
        AND (${conditions})
    `);
    return rows.map((r) => r.id);
  }

  if (filter === "loyal") {
    const members = await prisma.loyaltyMember.findMany({
      where: { ...base, completedCards: { gte: 1 } },
      select: { id: true },
    });
    return members.map((m) => m.id);
  }

  if (filter === "active") {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const members = await prisma.loyaltyMember.findMany({
      where: { ...base, lastStampAt: { gte: since } },
      select: { id: true },
    });
    return members.map((m) => m.id);
  }

  if (filter === "inactive") {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const members = await prisma.loyaltyMember.findMany({
      where: { ...base, OR: [{ lastStampAt: null }, { lastStampAt: { lt: since } }] },
      select: { id: true },
    });
    return members.map((m) => m.id);
  }

  if (filter === "no_stamps") {
    const members = await prisma.loyaltyMember.findMany({
      where: { ...base, stamps: 0, completedCards: 0 },
      select: { id: true },
    });
    return members.map((m) => m.id);
  }

  // "all" — default
  const members = await prisma.loyaltyMember.findMany({
    where: base,
    select: { id: true },
  });
  return members.map((m) => m.id);
}
