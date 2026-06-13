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

  // Run extraction 3 times and merge results (Jina free tier is flaky)
  console.log("=== Running 3 extractions and merging ===\n");
  const allDishes = new Map<string, any>(); // key: catName|dishName

  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`\n--- Attempt ${attempt}/3 ---`);
    try {
      const result = await extractOlaClick("https://tarantarestaurante.ola.click/products");
      for (const d of result.dishes) {
        const key = `${d.category}|${d.name}`;
        if (!allDishes.has(key)) allDishes.set(key, d);
      }
      console.log(`Got ${result.dishes.length} dishes, total unique: ${allDishes.size}`);
    } catch (e: any) {
      console.log(`Attempt ${attempt} failed: ${e.message}`);
    }
    // Small delay between attempts
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
  }

  const dishes = [...allDishes.values()];
  console.log(`\n=== MERGED: ${dishes.length} unique dishes ===\n`);

  // Group by category
  const categoryMap = new Map<string, typeof dishes>();
  for (const dish of dishes) {
    const cat = dish.category || "General";
    if (!categoryMap.has(cat)) categoryMap.set(cat, []);
    categoryMap.get(cat)!.push(dish);
  }

  for (const [cat, d] of categoryMap) console.log(`  ${cat}: ${d.length}`);

  // Delete and recreate
  console.log("\n=== Replacing data ===");
  await prisma.dish.deleteMany({ where: { restaurantId: r.id } });
  await prisma.category.deleteMany({ where: { restaurantId: r.id } });

  let catPosition = 0;
  let totalDishes = 0;

  for (const [catName, catDishes] of categoryMap) {
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
  }

  console.log(`\n✅ Done: ${totalDishes} dishes in ${catPosition} categories`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
