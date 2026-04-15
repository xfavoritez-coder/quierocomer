import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

// Category → default meal times
const CAT_MEALS: Record<string, string[]> = {
  BREAKFAST: ["DESAYUNO", "BRUNCH"],
  BRUNCH: ["BRUNCH", "DESAYUNO", "ONCE"],
  COFFEE: ["DESAYUNO", "BRUNCH", "ONCE"],
  TEA: ["ONCE", "DESAYUNO"],
  SMOOTHIE: ["DESAYUNO", "BRUNCH", "ONCE", "SNACK"],
  JUICE: ["DESAYUNO", "BRUNCH", "SNACK"],
  SUSHI: ["ALMUERZO", "CENA"],
  MAIN_COURSE: ["ALMUERZO", "CENA"],
  PASTA: ["ALMUERZO", "CENA"],
  PIZZA: ["ALMUERZO", "CENA", "SNACK"],
  BURGER: ["ALMUERZO", "CENA", "SNACK"],
  SANDWICH: ["ALMUERZO", "ONCE", "SNACK"],
  SALAD: ["ALMUERZO"],
  SOUP: ["ALMUERZO", "CENA"],
  SEAFOOD: ["ALMUERZO", "CENA"],
  WOK: ["ALMUERZO", "CENA"],
  STARTER: ["ALMUERZO", "CENA"],
  SHARING: ["ALMUERZO", "CENA"],
  COMBO: ["ALMUERZO", "CENA"],
  DESSERT: ["ALMUERZO", "ONCE", "CENA"],
  ICE_CREAM: ["ONCE", "SNACK"],
  SNACK: ["ONCE", "SNACK"],
  VEGETARIAN: ["ALMUERZO", "CENA"],
  VEGAN: ["ALMUERZO", "CENA"],
  DRINK: ["ALMUERZO", "CENA", "ONCE"],
  COCKTAIL: ["CENA"],
  BEER: ["ALMUERZO", "CENA"],
  WINE: ["ALMUERZO", "CENA"],
};

// Special overrides by name
function getMealsByName(nombre: string, cat: string): string[] | null {
  const n = nombre.toLowerCase();
  // Croissants → desayuno, brunch, once
  if (n.includes("croissant")) return ["DESAYUNO", "BRUNCH", "ONCE"];
  // Waffles → desayuno, brunch, once
  if (n.includes("waffle")) return ["DESAYUNO", "BRUNCH", "ONCE"];
  // Tostada → desayuno, brunch
  if (n.includes("tostada")) return ["DESAYUNO", "BRUNCH"];
  // Pailón, huevos → desayuno, brunch
  if (n.includes("pailón") || n.includes("huevo")) return ["DESAYUNO", "BRUNCH"];
  // Fondue → once, cena
  if (n.includes("fondue")) return ["ONCE", "CENA"];
  // Batido, milkshake → once, snack
  if (n.includes("batido") || n.includes("milkshake")) return ["ONCE", "SNACK"];
  // Ramen → almuerzo, cena
  if (n.includes("ramen")) return ["ALMUERZO", "CENA"];
  // Bowl → almuerzo
  if (n.includes("bowl")) return ["ALMUERZO"];
  // Ensalada → almuerzo
  if (n.includes("ensalada")) return ["ALMUERZO"];
  return null;
}

async function main() {
  const dishes = await p.menuItem.findMany({ select: { id: true, nombre: true, categoria: true, mealTimes: true } });
  console.log(`Total platos: ${dishes.length}`);

  let updated = 0;
  for (const dish of dishes) {
    const byName = getMealsByName(dish.nombre, dish.categoria);
    const meals = byName ?? CAT_MEALS[dish.categoria] ?? ["ALMUERZO", "CENA"];

    if (JSON.stringify(dish.mealTimes.sort()) !== JSON.stringify(meals.sort())) {
      await p.menuItem.update({ where: { id: dish.id }, data: { mealTimes: meals } });
      updated++;
    }
  }

  console.log(`${updated} platos actualizados con mealTimes`);

  // Summary
  const all = await p.menuItem.findMany({ select: { mealTimes: true } });
  const counts: Record<string, number> = {};
  for (const d of all) {
    for (const m of d.mealTimes) {
      counts[m] = (counts[m] ?? 0) + 1;
    }
  }
  console.log("\nPlatos por momento:");
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => console.log(`  ${m}: ${c}`));
}

main().finally(() => p.$disconnect());
