import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findFirst({ where: { name: { contains: "nmortal", mode: "insensitive" } }, select: { id: true, name: true, slug: true } });
  if (!r) { console.log("Not found"); return; }
  console.log("Restaurant:", r.name, r.slug);
  const promos = await prisma.promotion.findMany({ where: { restaurantId: r.id }, select: { id: true, name: true, description: true, promoType: true, imageUrl: true, discountPct: true, promoPrice: true, originalPrice: true, isActive: true } });
  console.log("\nPromos:", promos.length);
  for (const p of promos) console.log(JSON.stringify(p, null, 2));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
