import { prisma } from "@/lib/prisma";

/**
 * Sincroniza Dish.discountPrice de un restaurante según las promociones activas
 * HOY (respetando daysOfWeek y el rango de fechas validFrom/validUntil), en hora
 * de Chile. Todas las cartas (QR, ecommerce, feed, POS) leen Dish.discountPrice,
 * así que aquí es donde se "enciende/apaga" la oferta según el día.
 *
 * - Un plato con promo activa hoy → discountPrice = menor entre el promoPrice activo
 *   y su oferta base (baseDiscountPrice), para que el cliente siempre vea lo más barato.
 * - Un plato que pertenece a alguna promo pero SIN promo activa hoy → discountPrice =
 *   su OFERTA BASE (baseDiscountPrice), NO null. Así una oferta permanente del producto
 *   (ej. Promo 60 a $25.900 siempre) no se pierde los días que la promo especial no aplica.
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

  if (!managed.size) return;

  // Oferta base de cada plato gobernado (PRECIO OFERTA del producto).
  const dishes = await prisma.dish.findMany({ where: { id: { in: [...managed] } }, select: { id: true, baseDiscountPrice: true } });
  const baseMap = new Map(dishes.map((d) => [d.id, d.baseDiscountPrice ?? null]));

  // Precio objetivo por plato: promo activa (min con la base) o, sin promo hoy, la base.
  const targets = new Map<string, number | null>();
  for (const id of managed) {
    const promoP = best.get(id) ?? null;
    const base = baseMap.get(id) ?? null;
    let target: number | null;
    if (promoP != null) target = base != null ? Math.min(promoP, base) : promoP;
    else target = base; // sin promo hoy → vuelve a la oferta base (null si no hay)
    targets.set(id, target);
  }

  const byVal = new Map<number | null, string[]>();
  for (const [id, v] of targets) {
    const arr = byVal.get(v) ?? [];
    arr.push(id);
    byVal.set(v, arr);
  }

  const ops = [...byVal].map(([v, ids]) => prisma.dish.updateMany({ where: { id: { in: ids } }, data: { discountPrice: v } }));
  if (ops.length) await prisma.$transaction(ops);
}
