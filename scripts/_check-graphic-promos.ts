import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const promos = await prisma.promotion.findMany({
    where: { promoType: "graphic" },
    select: { id: true, name: true, imageUrl: true, status: true, restaurant: { select: { name: true, slug: true } } },
  });
  console.log("Graphic promos:", promos.length);
  for (const p of promos) console.log(p.restaurant.name, "|", p.name, "|", p.imageUrl?.substring(0, 80), "| status:", p.status);

  const restaurants = await prisma.restaurant.findMany({
    where: { name: { contains: "mortal", mode: "insensitive" } },
    select: { name: true, slug: true },
  });
  console.log("\nRestaurants matching 'mortal':", restaurants);

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
