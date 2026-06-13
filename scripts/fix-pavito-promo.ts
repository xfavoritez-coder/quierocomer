import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const restId = (await db.restaurant.findFirst({ where: { slug: "la-picada-del-pa-vito" } }))!.id;

  // Get existing promo data
  const oldPromo = await db.promotion.findFirst({
    where: { restaurantId: restId, status: "ACTIVE" },
  });
  console.log("Promo actual:", oldPromo?.name, "price:", oldPromo?.promoPrice, "dishIds:", oldPromo?.dishIds);

  if (oldPromo) {
    // Delete it
    await db.promotion.delete({ where: { id: oldPromo.id } });
    console.log("✓ Promo borrada:", oldPromo.id);

    // Create new one with same data
    const newPromo = await db.promotion.create({
      data: {
        restaurantId: restId,
        name: oldPromo.name,
        description: oldPromo.description,
        promoType: "product",
        dishIds: oldPromo.dishIds,
        originalPrice: oldPromo.originalPrice,
        promoPrice: oldPromo.promoPrice,
        discountPct: oldPromo.discountPct,
        status: "ACTIVE",
        generatedBy: "manual",
      },
    });
    console.log("✓ Nueva promo creada:", newPromo.id, newPromo.name);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
