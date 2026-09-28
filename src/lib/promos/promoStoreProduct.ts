// ═══════════════════════════════════════════════════════════
//  Producto de tienda para una promoción gráfica.
//  Cuando el dueño marca "vender también en la tienda", la promo
//  crea/actualiza un Dish vinculado (Promotion.linkedDishId) en una
//  categoría "Promociones". Así aparece en el ecommerce y en el
//  catálogo, donde se le asigna el código Toteat (toteatProductId).
// ═══════════════════════════════════════════════════════════
import { prisma } from "@/lib/prisma";

const PROMO_CATEGORY = "Promociones";

/** Devuelve el id de la categoría "Promociones" del local (la crea si no existe). */
async function ensurePromoCategory(restaurantId: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { restaurantId, name: { equals: PROMO_CATEGORY, mode: "insensitive" } },
    select: { id: true },
    orderBy: { position: "asc" },
  });
  if (existing) return existing.id;
  const last = await prisma.category.findFirst({ where: { restaurantId }, orderBy: { position: "desc" }, select: { position: true } });
  const cat = await prisma.category.create({
    data: { restaurantId, name: PROMO_CATEGORY, position: (last?.position ?? 0) + 1, isActive: true },
    select: { id: true },
  });
  return cat.id;
}

interface PromoLike {
  id: string; restaurantId: string; name: string; description: string | null;
  imageUrl: string | null; thumbUrl: string | null;
  originalPrice: number | null; promoPrice: number | null; linkedDishId: string | null;
}

/** Precio normal (tachado) y de oferta a partir de la promo. */
function prices(p: PromoLike): { price: number; discountPrice: number | null } {
  const orig = p.originalPrice ?? null;
  const promo = p.promoPrice ?? null;
  if (orig != null && promo != null && promo < orig) return { price: orig, discountPrice: promo };
  return { price: promo ?? orig ?? 0, discountPrice: null };
}

/** Crea o actualiza el Dish vinculado a la promo. Devuelve el dishId. */
export async function ensurePromoDish(promoId: string): Promise<string | null> {
  const promo = await prisma.promotion.findUnique({
    where: { id: promoId },
    select: { id: true, restaurantId: true, name: true, description: true, imageUrl: true, thumbUrl: true, originalPrice: true, promoPrice: true, linkedDishId: true },
  });
  if (!promo) return null;
  const { price, discountPrice } = prices(promo);
  const photos = [promo.imageUrl].filter((x): x is string => !!x);

  // ¿Ya tiene un Dish vinculado y sigue vivo? → actualizar.
  if (promo.linkedDishId) {
    const dish = await prisma.dish.findUnique({ where: { id: promo.linkedDishId }, select: { id: true } });
    if (dish) {
      await prisma.dish.update({
        where: { id: dish.id },
        data: { name: promo.name, description: promo.description, price, discountPrice, ...(photos.length ? { photos } : {}), isActive: true, deletedAt: null },
      });
      return dish.id;
    }
  }

  // Crear un Dish nuevo en la categoría "Promociones".
  const categoryId = await ensurePromoCategory(promo.restaurantId);
  const last = await prisma.dish.findFirst({ where: { categoryId }, orderBy: { position: "desc" }, select: { position: true } });
  const created = await prisma.dish.create({
    data: {
      restaurantId: promo.restaurantId, categoryId, name: promo.name, description: promo.description,
      price, discountPrice, photos, isActive: true, position: (last?.position ?? 0) + 1,
      // Campos de lista sin default en el schema → deben enviarse explícitos.
      flavorTags: [], txDishType: [], txCuisine: [], txMealSlot: [], txIngredient: [], txEstilo: [],
    },
    select: { id: true },
  });
  await prisma.promotion.update({ where: { id: promo.id }, data: { linkedDishId: created.id } });
  return created.id;
}

/**
 * Enciende/apaga el Dish vinculado de cada promo según si la promo está activa
 * HOY (status ACTIVE + daysOfWeek + rango validFrom/validUntil), hora de Chile.
 * Así el producto de la tienda solo se muestra los días marcados y dentro del
 * rango. Se llama al crear/editar la promo y en el cron diario.
 */
export async function syncPromoStoreProductsActive(restaurantId: string): Promise<void> {
  const promos = await prisma.promotion.findMany({
    where: { restaurantId, linkedDishId: { not: null } },
    select: { linkedDishId: true, status: true, daysOfWeek: true, validFrom: true, validUntil: true },
  });
  if (!promos.length) return;

  const cl = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Santiago" }));
  const today = cl.getDay(); // 0=Dom .. 6=Sáb
  const nowMs = Date.now();

  const activate: string[] = [];
  const deactivate: string[] = [];
  for (const p of promos) {
    if (!p.linkedDishId) continue;
    let on = p.status === "ACTIVE";
    if (on && p.daysOfWeek?.length && !p.daysOfWeek.includes(today)) on = false;
    if (on && p.validFrom && p.validFrom.getTime() > nowMs) on = false;
    if (on && p.validUntil && p.validUntil.getTime() < nowMs) on = false;
    (on ? activate : deactivate).push(p.linkedDishId);
  }

  const ops = [];
  // Al reactivar no tocamos deletedAt (si estaba soft-deleted por "quitar de tienda",
  // su promo ya no tiene linkedDishId, así que no entra aquí).
  if (activate.length) ops.push(prisma.dish.updateMany({ where: { id: { in: activate }, deletedAt: null }, data: { isActive: true } }));
  if (deactivate.length) ops.push(prisma.dish.updateMany({ where: { id: { in: deactivate } }, data: { isActive: false } }));
  if (ops.length) await prisma.$transaction(ops);
}

/** Desactiva (soft-delete) el Dish vinculado y limpia el vínculo. */
export async function removePromoDish(promoId: string): Promise<void> {
  const promo = await prisma.promotion.findUnique({ where: { id: promoId }, select: { linkedDishId: true } });
  if (!promo?.linkedDishId) return;
  await prisma.dish.updateMany({ where: { id: promo.linkedDishId }, data: { isActive: false, deletedAt: new Date() } }).catch(() => {});
  await prisma.promotion.update({ where: { id: promoId }, data: { linkedDishId: null } }).catch(() => {});
}
