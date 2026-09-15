import { prisma } from "@/lib/prisma";

/**
 * Sincroniza Dish.discountPrice de un restaurante según las promociones activas
 * HOY (respetando daysOfWeek y el rango de fechas validFrom/validUntil), en hora
 * de Chile. Todas las cartas (QR, ecommerce, feed, POS) leen Dish.discountPrice,
 * así que aquí es donde se "enciende/apaga" la oferta según el día.
 *
 * - Un plato con promo activa hoy → discountPrice = menor promoPrice activo.
 * - Un plato que pertenece a alguna promo pero SIN promo activa hoy → discountPrice = null.
 * - Los platos que no están en ninguna promo no se tocan (respeta descuentos manuales).
 *
 * `extraDishIds` asegura reevaluar los platos de la promo recién editada/eliminada.
 */
export async function syncRestaurantDishDiscounts(restaurantId: string, extraDishIds: string[] = []): Promise<void> {
  const promos = await prisma.promotion.findMany({
    where: { restaurantId },
    select: { dishIds: true, promoPrice: true, status: true, daysOfWeek: true, validFrom: true, validUntil: true },
  });

  const cl = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const today = cl.getDay(); // 0=Dom .. 6=Sáb (misma convención que daysOfWeek)
  const nowMs = Date.now();

  const managed = new Set<string>(extraDishIds); // platos gobernados por promos
  const best = new Map<string, number>(); // dishId → menor promoPrice activo hoy

  for (const p of promos) {
    for (const id of p.dishIds) managed.add(id);
    if (p.status !== "ACTIVE" || p.promoPrice == null || p.promoPrice <= 0) continue;
    if (p.daysOfWeek?.length && !p.daysOfWeek.includes(today)) continue; // no aplica hoy
    if (p.validFrom && p.validFrom.getTime() > nowMs) continue; // aún no empieza
    if (p.validUntil && p.validUntil.getTime() < nowMs) continue; // ya terminó
    for (const id of p.dishIds) {
      const cur = best.get(id);
      if (cur == null || p.promoPrice < cur) best.set(id, p.promoPrice);
    }
  }

  const clearIds = [...managed].filter((id) => !best.has(id));
  const byPrice = new Map<number, string[]>();
  for (const [id, price] of best) {
    const arr = byPrice.get(price) ?? [];
    arr.push(id);
    byPrice.set(price, arr);
  }

  const ops = [];
  for (const [price, ids] of byPrice) ops.push(prisma.dish.updateMany({ where: { id: { in: ids } }, data: { discountPrice: price } }));
  if (clearIds.length) ops.push(prisma.dish.updateMany({ where: { id: { in: clearIds } }, data: { discountPrice: null } }));
  if (ops.length) await prisma.$transaction(ops);
}
