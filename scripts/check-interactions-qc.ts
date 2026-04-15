import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const interactions = await p.interaction.count();
  const profiles = await p.userTasteProfile.count();
  const ratings = await p.dishRating.count();
  console.log("Interactions:", interactions);
  console.log("Profiles:", profiles);
  console.log("Ratings:", ratings);

  if (interactions > 0) {
    const byAction = await p.interaction.groupBy({ by: ["action"], _count: true });
    console.log("\nPor acción:");
    byAction.forEach(a => console.log(`  ${a.action}: ${a._count}`));

    const recent = await p.interaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { action: true, sessionId: true, menuItem: { select: { nombre: true } }, createdAt: true },
    });
    console.log("\nÚltimas 5:");
    recent.forEach(r => console.log(`  ${r.action} | ${r.menuItem.nombre} | ${r.sessionId.slice(0,8)} | ${r.createdAt}`));
  }

  if (profiles > 0) {
    const all = await p.userTasteProfile.findMany({ select: { userId: true, favoriteIngredients: true, avoidIngredients: true, dietaryRestrictions: true, onboardingDone: true } });
    console.log("\nPerfiles:");
    all.forEach(p => console.log(`  user:${p.userId.slice(0,8)} | fav:${p.favoriteIngredients.length} | avoid:${p.avoidIngredients.length} | diet:${p.dietaryRestrictions.join(",")} | onboarding:${p.onboardingDone}`));
  }
}
main().finally(() => p.$disconnect());
