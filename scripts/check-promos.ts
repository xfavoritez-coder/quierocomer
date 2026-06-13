import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const promos = await p.restaurantPromotion.findMany({
    select: { id: true, type: true, message: true, dishId: true, isActive: true, restaurantId: true, restaurant: { select: { name: true, slug: true } }, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.log("Total promos:", promos.length);
  for (const promo of promos) {
    console.log(`  ${promo.restaurant?.name} | type=${promo.type} | ${(promo.message || "").substring(0, 60)} | active=${promo.isActive}`);
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
