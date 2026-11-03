import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// daysOfWeek: 0=Dom 1=Lun 2=Mar 3=Mié 4=Jue 5=Vie 6=Sáb

const RESTAURANTS = [
  {
    slug: "kojo-sushi-la-florida",
    deluxeId: "cmubc0yvq0008jv04zyvvopoa",  // Deluxe (60 piezas)
    supremaId: "cmubc0yv50006jv0414yml2b9",  // Suprema 40 piezas premium
  },
  {
    slug: "kojo-sushi-recoleta",
    deluxeId: "cmvcjbxdb001pjn07ad700h7k",   // Deluxe (60 piezas)
    supremaId: "cmvcjbx9n0015jn07w1mz3w14",  // Suprema (40 piezas premium)
  },
];

async function ensurePromoCategory(restaurantId: string): Promise<string> {
  const existing = await prisma.category.findFirst({
    where: { restaurantId, name: { equals: "Promociones", mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const last = await prisma.category.findFirst({ where: { restaurantId }, orderBy: { position: "desc" }, select: { position: true } });
  const cat = await prisma.category.create({
    data: { restaurantId, name: "Promociones", position: (last?.position ?? 0) + 1, isActive: true },
    select: { id: true },
  });
  return cat.id;
}

async function createLinkedDish(restaurantId: string, name: string, price: number, description: string): Promise<string> {
  const categoryId = await ensurePromoCategory(restaurantId);
  const last = await prisma.dish.findFirst({ where: { categoryId }, orderBy: { position: "desc" }, select: { position: true } });
  const dish = await prisma.dish.create({
    data: {
      restaurantId, categoryId, name, description, price,
      discountPrice: null, isActive: false, // el cron lo activa el día correcto
      position: (last?.position ?? 0) + 1,
      flavorTags: [], txDishType: [], txCuisine: [], txMealSlot: [], txIngredient: [], txEstilo: [],
    },
    select: { id: true },
  });
  return dish.id;
}

async function processRestaurant(r: typeof RESTAURANTS[0]) {
  const restaurant = await prisma.restaurant.findUnique({ where: { slug: r.slug }, select: { id: true, name: true } });
  if (!restaurant) { console.log(`⚠ No encontrado: ${r.slug}`); return; }
  const { id: restaurantId, name } = restaurant;

  console.log(`\n── ${name} (${r.slug}) ──`);

  // 1. Lunes + Jueves: Deluxe 22.900 (normal 25.900)
  const promoDeluxe = await prisma.promotion.create({
    data: {
      restaurantId, name: "Deluxe", status: "ACTIVE",
      dishIds: [r.deluxeId],
      originalPrice: 25900, promoPrice: 22900,
      daysOfWeek: [1, 4], // Lunes=1, Jueves=4
    },
    select: { id: true },
  });
  console.log(`✓ Promo Deluxe (Lun+Jue): ${promoDeluxe.id}`);

  // 2. Martes: Suprema → "Martes de suprema" 19.900 (normal 24.900)
  //    Crea un linkedDish para que aparezca renombrado en el ecommerce los martes.
  const martesDishId = await createLinkedDish(restaurantId, "Martes de suprema", 24900, "El roll suprema a precio especial cada martes.");
  const promoSuprema = await prisma.promotion.create({
    data: {
      restaurantId, name: "Martes de suprema", status: "ACTIVE",
      dishIds: [r.supremaId],
      originalPrice: 24900, promoPrice: 19900,
      daysOfWeek: [2], // Martes=2
      linkedDishId: martesDishId,
    },
    select: { id: true },
  });
  console.log(`✓ Promo Suprema (Mar): ${promoSuprema.id} — linked dish: ${martesDishId}`);

  // 3. Miércoles: producto nuevo "Miércoles Mix" 13.900
  const miercolesId = await createLinkedDish(restaurantId, "Miércoles Mix", 13900, "Todas las semanas nuevos rolls.");
  const promoMiercoles = await prisma.promotion.create({
    data: {
      restaurantId, name: "Miércoles Mix", status: "ACTIVE",
      dishIds: [], // producto nuevo, no aplica descuento a otro plato
      originalPrice: null, promoPrice: 13900,
      daysOfWeek: [3], // Miércoles=3
      linkedDishId: miercolesId,
    },
    select: { id: true },
  });
  console.log(`✓ Promo Miércoles Mix: ${promoMiercoles.id} — linked dish: ${miercolesId}`);

  // Sincronizar discountPrice en los platos existentes
  const { syncRestaurantDishDiscounts } = await import("../src/lib/promos/syncDishDiscounts");
  await syncRestaurantDishDiscounts(restaurantId, [r.deluxeId, r.supremaId]);
  console.log(`✓ discountPrice sincronizado`);

  // Activar/desactivar linked dishes según día de hoy
  const { syncPromoStoreProductsActive } = await import("../src/lib/promos/promoStoreProduct");
  await syncPromoStoreProductsActive(restaurantId);
  console.log(`✓ linked dishes sincronizados`);
}

async function main() {
  for (const r of RESTAURANTS) {
    await processRestaurant(r);
  }
  console.log("\n✅ Listo");
}

main().catch(console.error).finally(() => prisma.$disconnect());
