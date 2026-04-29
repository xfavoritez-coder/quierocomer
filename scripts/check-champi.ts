import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const dish = await p.dish.findFirst({
    where: { name: "Champi furai", restaurant: { slug: "horusvegan" } },
    select: { name: true, tags: true, isHighMargin: true, isFeaturedAuto: true, createdAt: true, dishDiet: true, isSpicy: true, flavorTags: true, dishIngredients: { select: { ingredient: { select: { name: true } } } } },
  });
  console.log(JSON.stringify(dish, null, 2));

  // Also check: what's the base scoring giving +10?
  const allDishes = await p.dish.findMany({
    where: { restaurant: { slug: "horusvegan" }, isActive: true },
    select: { name: true, tags: true, isHighMargin: true, isFeaturedAuto: true, createdAt: true },
  });
  const withFlags = allDishes.filter(d => d.tags.length > 0 || d.isHighMargin || d.isFeaturedAuto);
  console.log("\nPlatos con flags:");
  for (const d of withFlags) {
    console.log(`  ${d.name}: tags=${JSON.stringify(d.tags)} margin=${d.isHighMargin} featured=${d.isFeaturedAuto}`);
  }

  // Check if dish is <7 days old (NEW bonus +5)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newDishes = allDishes.filter(d => new Date(d.createdAt) > sevenDaysAgo);
  console.log("\nPlatos nuevos (<7 días):");
  for (const d of newDishes) {
    console.log(`  ${d.name}: creado ${new Date(d.createdAt).toISOString().split("T")[0]}`);
  }

  await p.$disconnect();
}
main();
