import { PrismaClient } from "@prisma/client";
import { scoreDish, type ScoringDish, type ScoringContext } from "../src/lib/qr/utils/dishScoring";
import type { CompiledProfile } from "../src/lib/qr/utils/compileProfile";

const p = new PrismaClient();
async function main() {
  const restaurant = await p.restaurant.findFirst({ where: { slug: "horusvegan" }, select: { id: true } });
  if (!restaurant) return;

  const categories = await p.category.findMany({ where: { restaurantId: restaurant.id, isActive: true }, select: { id: true, name: true } });
  const catNames: Record<string, string> = {};
  for (const c of categories) catNames[c.id] = c.name;

  // Simulate carnivore profile with gluten restriction
  const profile: CompiledProfile = {
    dietType: "omnivore",
    restrictions: ["gluten"],
    likedIngredients: {},
    dislikedIngredients: [],
    viewHistory: [],
    visitCount: 3,
    visitedCategoryIds: [],
    lastSessionDate: new Date(),
  };

  const dishes = await p.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true, deletedAt: null, category: { name: "Para compartir" } },
    include: { dishIngredients: { include: { ingredient: { include: { allergens: true } } } } },
    orderBy: { position: "asc" },
  });

  const ctx: ScoringContext = { timeOfDay: "DINNER", weather: "CLEAR", categoryNames: catNames };

  console.log("Para compartir — scores (carnívoro + sin gluten):");
  for (const d of dishes) {
    const result = scoreDish(d as unknown as ScoringDish, profile, ctx);
    console.log(`  pos=${d.position} | score=${result.score} | ${d.name} | reason: ${result.reason || "ninguna"}`);
  }

  await p.$disconnect();
}
main();
