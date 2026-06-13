import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const dishes = await p.dish.findMany({
    where: { restaurant: { slug: "forty-four" }, discountPrice: { not: null } },
    select: { name: true, price: true, discountPrice: true },
    take: 5,
  });
  console.log("With discountPrice:", dishes.length);
  for (const d of dishes) console.log(`  ${d.name}: $${d.price} → $${d.discountPrice}`);

  // Also check promos
  const promos = await p.promotion.findMany({
    where: { restaurant: { slug: "forty-four" }, status: "ACTIVE" },
    select: { name: true, originalPrice: true, promoPrice: true, dishIds: true },
  });
  console.log("\nActive promos:", promos.length);
  for (const p2 of promos) console.log(`  ${p2.name}: $${p2.originalPrice} → $${p2.promoPrice} (${p2.dishIds.length} dishes)`);

  await p.$disconnect();
}
main();
