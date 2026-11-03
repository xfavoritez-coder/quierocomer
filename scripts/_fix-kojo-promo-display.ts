import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const ICON = "🔥";

const DATA = [
  {
    slug: "kojo-sushi-la-florida",
    restaurantId: "cmubc0yoq0001jv041si8zicn",
    // Deluxe: crear linkedDish (hoy no existe)
    deluxePromoId: "cmw0s375z0001enjkl62w0esh",
    deluxeDishId: "cmubc0yvq0008jv04zyvvopoa",
    // Martes de suprema: ya tiene linkedDish, solo actualizar
    martesLinkedId: "cmw0s38sv0003enjkdd0xpxfe",
    // Miércoles Mix: ya tiene linkedDish, solo actualizar
    miercolesLinkedId: "cmw0s3ayp0007enjk0hb9f0i3",
  },
  {
    slug: "kojo-sushi-recoleta",
    restaurantId: "cmvcjbx090001jn074i0eg9zu",
    deluxePromoId: "cmw0s3g3o000benjkyr27jzr0",
    deluxeDishId: "cmvcjbxdb001pjn07ad700h7k",
    martesLinkedId: "cmw0s3hqv000denjkvx3egjs7",
    miercolesLinkedId: "cmw0s3k02000henjkc698ap34",
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

async function main() {
  for (const r of DATA) {
    console.log(`\n── ${r.slug} ──`);

    // 1. Añadir icono a Martes de suprema y Miércoles Mix (si no lo tienen ya)
    const martes = await prisma.dish.findUnique({ where: { id: r.martesLinkedId }, select: { name: true } });
    if (martes && !martes.name.startsWith(ICON)) {
      await prisma.dish.update({ where: { id: r.martesLinkedId }, data: { name: `${ICON} Martes de suprema` } });
      console.log(`✓ Nombre actualizado: ${ICON} Martes de suprema`);
    }

    const miercoles = await prisma.dish.findUnique({ where: { id: r.miercolesLinkedId }, select: { name: true } });
    if (miercoles && !miercoles.name.startsWith(ICON)) {
      await prisma.dish.update({ where: { id: r.miercolesLinkedId }, data: { name: `${ICON} Miércoles Mix` } });
      console.log(`✓ Nombre actualizado: ${ICON} Miércoles Mix`);
    }

    // 2. Crear linkedDish para Deluxe
    const deluxe = await prisma.dish.findUnique({ where: { id: r.deluxeDishId }, select: { photos: true, name: true } });
    if (!deluxe) { console.log(`⚠ Deluxe no encontrado`); continue; }

    const categoryId = await ensurePromoCategory(r.restaurantId);
    const deluxeLinked = await prisma.dish.create({
      data: {
        restaurantId: r.restaurantId, categoryId,
        name: `${ICON} Deluxe`, description: "El clásico Deluxe a precio especial.",
        price: 25900, discountPrice: 22900,
        photos: deluxe.photos,
        isActive: false, // el sync lo activa lunes/jueves
        position: 1,
        flavorTags: [], txDishType: [], txCuisine: [], txMealSlot: [], txIngredient: [], txEstilo: [],
      },
      select: { id: true },
    });
    await prisma.promotion.update({ where: { id: r.deluxePromoId }, data: { linkedDishId: deluxeLinked.id } });
    console.log(`✓ Linked dish Deluxe creado: ${deluxeLinked.id}`);

    // 3. Setear posiciones: Deluxe=1, Martes=2, Miércoles=3
    await prisma.dish.update({ where: { id: deluxeLinked.id }, data: { position: 1 } });
    await prisma.dish.update({ where: { id: r.martesLinkedId }, data: { position: 2 } });
    await prisma.dish.update({ where: { id: r.miercolesLinkedId }, data: { position: 3 } });
    console.log(`✓ Posiciones: Deluxe=1, Martes=2, Miércoles=3`);
  }

  // 4. Sync para aplicar estado según día de hoy
  const { syncPromoStoreProductsActive } = await import("../src/lib/promos/promoStoreProduct");
  const { syncRestaurantDishDiscounts } = await import("../src/lib/promos/syncDishDiscounts");

  for (const r of DATA) {
    const allDishIds = [r.deluxeDishId];
    await syncRestaurantDishDiscounts(r.restaurantId, allDishIds);
    await syncPromoStoreProductsActive(r.restaurantId);
    console.log(`\n✓ sync: ${r.slug}`);
  }

  console.log("\n✅ Listo");
}

main().catch(console.error).finally(() => prisma.$disconnect());
