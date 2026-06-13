import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const promos = await db.restaurantPromotion.findMany({
    where: { restaurant: { slug: "la-picada-del-pa-vito" }, isActive: true },
    select: { id: true, name: true, promoType: true, promoPrice: true, dishIds: true, imageUrl: true },
  });
  for (const p of promos) {
    console.log(`${p.name} — type: ${p.promoType}, price: ${p.promoPrice}, dishIds: ${p.dishIds?.length || 0}, image: ${!!p.imageUrl}`);
    if (p.dishIds?.length) {
      const dishes = await db.dish.findMany({
        where: { id: { in: p.dishIds } },
        select: { id: true, name: true },
      });
      dishes.forEach(d => console.log(`  - ${d.name}`));
    }
  }
}
main().catch(console.error).finally(() => db.$disconnect());
