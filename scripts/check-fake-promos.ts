import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const promos = await p.promotion.findMany({
    select: { id: true, name: true, description: true, status: true, restaurantId: true, promoType: true, discountPct: true, promoPrice: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Total promotions: ${promos.length}\n`);
  for (const pr of promos) {
    const rest = await p.restaurant.findUnique({ where: { id: pr.restaurantId }, select: { name: true, slug: true } });
    console.log(`${rest?.name?.padEnd(30) || "?"} | ${pr.name.padEnd(25)} | ${pr.status.padEnd(8)} | ${pr.promoType?.padEnd(12) || "?"} | ${pr.discountPct || pr.promoPrice || "-"} | ${pr.createdAt.toISOString().slice(0,10)}`);
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
