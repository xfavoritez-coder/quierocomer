import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// IDs de las promos "Martes de suprema" y sus platos originales
const MARTES = [
  {
    slug: "kojo-sushi-la-florida",
    supremaId: "cmubc0yv50006jv0414yml2b9",        // plato original Suprema
    linkedDishId: "cmw0s38sv0003enjkdd0xpxfe",      // linked dish "Martes de suprema"
  },
  {
    slug: "kojo-sushi-recoleta",
    supremaId: "cmvcjbx9n0015jn07w1mz3w14",         // plato original Suprema
    linkedDishId: "cmw0s3hqv000denjkvx3egjs7",      // linked dish "Martes de suprema"
  },
];

async function main() {
  for (const r of MARTES) {
    const suprema = await prisma.dish.findUnique({
      where: { id: r.supremaId },
      select: { photos: true, name: true },
    });
    if (!suprema) { console.log(`⚠ Suprema no encontrada: ${r.supremaId}`); continue; }

    console.log(`\n── ${r.slug} ──`);
    console.log(`  Suprema original: "${suprema.name}", fotos: ${suprema.photos.length}`);

    await prisma.dish.update({
      where: { id: r.linkedDishId },
      data: {
        price: 24900,          // precio normal (tachado)
        discountPrice: 19900,  // precio promo
        photos: suprema.photos,
      },
    });
    console.log(`  ✓ Martes de suprema: price=24.900, discountPrice=19.900, fotos copiadas`);
  }

  // Re-sincronizar estado activo/inactivo para ambos restaurantes
  const { syncPromoStoreProductsActive } = await import("../src/lib/promos/promoStoreProduct");
  const { syncRestaurantDishDiscounts } = await import("../src/lib/promos/syncDishDiscounts");

  const restaurants = await prisma.restaurant.findMany({
    where: { slug: { in: MARTES.map((r) => r.slug) } },
    select: { id: true, slug: true },
  });

  for (const rest of restaurants) {
    await syncRestaurantDishDiscounts(rest.id, MARTES.flatMap((r) => [r.supremaId, r.linkedDishId]));
    await syncPromoStoreProductsActive(rest.id);
    console.log(`\n  ✓ sync completado: ${rest.slug}`);
  }

  console.log("\n✅ Listo");
}

main().catch(console.error).finally(() => prisma.$disconnect());
