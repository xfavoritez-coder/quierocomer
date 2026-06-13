import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { extractOlaClick } from "../src/lib/extractors/olaclick";

const prisma = new PrismaClient();

function detectDishType(catName: string): string {
  if (/bebida|jugo|refresco|agua|gaseosa|soda|infusi[oó]n|t[eé]\b/i.test(catName)) return "drink";
  if (/cerveza|schop|draft|lager|ale|ipa|stout/i.test(catName)) return "drink";
  if (/vino|cepa|botella.*vino|copa.*vino|espumante|champa[gñ]/i.test(catName)) return "drink";
  if (/trago|cocktail|c[oó]ctel|mojito|pisco|whisky|destilado|licor|gin|ron|vodka|spritz/i.test(catName)) return "drink";
  if (/caf[eé]|cappuccino|espresso|latte|mocca|cafeter[ií]a/i.test(catName)) return "drink";
  if (/postre|dulce|helado|torta|kuchen|flan|tiramis[uú]/i.test(catName)) return "dessert";
  return "food";
}

async function main() {
  const slug = "taranta-chicureo";
  const r = await prisma.restaurant.findFirst({ where: { slug }, select: { id: true, name: true } });
  if (!r) { console.log("Not found"); return; }
  console.log(`Reprocessing: ${r.name} (${r.id})\n`);

  // Step 1: Extract fresh
  console.log("=== Extracting from OlaClick ===");
  const extraction = await extractOlaClick("https://tarantarestaurante.ola.click/products");
  console.log(`\nExtracted: ${extraction.dishes.length} dishes\n`);

  // Step 2: Delete existing dishes and categories
  console.log("=== Deleting old data ===");
  const deletedDishes = await prisma.dish.deleteMany({ where: { restaurantId: r.id } });
  const deletedCats = await prisma.category.deleteMany({ where: { restaurantId: r.id } });
  console.log(`Deleted: ${deletedDishes.count} dishes, ${deletedCats.count} categories\n`);

  // Step 3: Create new categories and dishes
  console.log("=== Creating new data ===");
  const categoryMap = new Map<string, typeof extraction.dishes>();
  for (const dish of extraction.dishes) {
    const cat = dish.category || "General";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(dish);
  }

  let catPosition = 0;
  let totalDishes = 0;

  for (const [catName, catDishes] of categoryMap) {
    const isDrinkCat = detectDishType(catName) !== "food";
    const category = await prisma.category.create({
      data: {
        restaurantId: r.id,
        name: catName,
        position: catPosition++,
        dishType: detectDishType(catName),
        isActive: true,
      },
    });

    for (let j = 0; j < catDishes.length; j++) {
      const dish = catDishes[j];
      await prisma.dish.create({
        data: {
          restaurantId: r.id,
          categoryId: category.id,
          name: dish.name.trim(),
          description: dish.description || null,
          price: dish.price,
          photos: [],
          position: j,
          dishDiet: "OMNIVORE",
          isActive: true,
        },
      });
      totalDishes++;
    }
    console.log(`  📂 ${catName}: ${catDishes.length} platos`);
  }

  console.log(`\n✅ Done: ${totalDishes} dishes in ${catPosition} categories`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
