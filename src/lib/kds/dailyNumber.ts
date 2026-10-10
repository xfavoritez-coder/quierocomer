import { prisma } from "@/lib/prisma";
import { chileDayRangeUtc } from "@/lib/driver/serialize";

/** YYYY-MM-DD del día calendario en hora de Chile para una fecha dada. */
function chileYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * Número de pedido corto que se reinicia cada día (hora de Chile), para el KDS.
 *
 * Es el rango por `createdAt` ascendente entre TODOS los PosOrder del local
 * creados ese mismo día calendario en Chile (incluye cancelados, para que el
 * número no se mueva cuando se cancela un pedido anterior). Es estable entre
 * refrescos porque `createdAt` nunca cambia, y no requiere columna nueva ni
 * migración. Devuelve un mapa `id -> número` (1-based).
 */
export async function dailyOrderNumbers(
  restaurantId: string,
  orders: { id: string; createdAt: Date }[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (!orders.length) return out;
  // Días (hora de Chile) presentes en el conjunto; normalmente uno solo (hoy).
  const days = new Set(orders.map((o) => chileYmd(o.createdAt)));
  for (const ymd of days) {
    const { start, end } = chileDayRangeUtc(ymd);
    const all = await prisma.posOrder.findMany({
      where: { restaurantId, createdAt: { gte: start, lte: end } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    all.forEach((o, i) => { out[o.id] = i + 1; });
  }
  return out;
}
