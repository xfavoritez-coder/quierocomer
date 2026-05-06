import { PrismaClient } from "@prisma/client";
import { getCrossSellDishes } from "../src/components/qr/carta/utils/getCrossSellDishes";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: "hand-roll" } });
  if (!r) return;

  const cats = await prisma.category.findMany({ where: { restaurantId: r.id } });
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null, isActive: true, toteatHidden: false },
  });

  console.log(`Hand Roll: ${dishes.length} platos activos visibles`);

  // Test: pick a "food" dish (Hand Roll item)
  const handRollCat = cats.find(c => c.name === "Hand Rolls");
  if (!handRollCat) { console.log("No Hand Rolls cat"); return; }
  const sample = dishes.find(d => d.categoryId === handRollCat.id && d.photos.length > 0);
  if (!sample) { console.log("No sample"); return; }
  console.log(`\nProbando con: ${sample.name} (cat: Hand Rolls<food>)`);

  const result = getCrossSellDishes(sample, dishes, cats, undefined, null);
  console.log(`\nTitulo: "${result.title}"`);
  console.log(`Items: ${result.items.length}`);
  for (const it of result.items) {
    const photo = it.dish.photos[0] || "[NO PHOTO]";
    console.log(`  - ${it.dish.name} (${it.reason}) | photo: ${photo.substring(0, 60)}`);
  }

  // Test 2: dish from Salsas y Extras (extra type, not in main flow)
  const salsasCat = cats.find(c => c.name === "Salsas y Extras");
  if (salsasCat) {
    const s2 = dishes.find(d => d.categoryId === salsasCat.id && d.photos.length > 0);
    if (s2) {
      console.log(`\nProbando con: ${s2.name} (cat: Salsas y Extras<extra>)`);
      const r2 = getCrossSellDishes(s2, dishes, cats, undefined, null);
      console.log(`  Titulo: "${r2.title}", items: ${r2.items.length}`);
      for (const it of r2.items) {
        const photo = it.dish.photos[0] || "[NO PHOTO]";
        console.log(`    - ${it.dish.name} (${it.reason}) | photo: ${photo.substring(0, 60)}`);
      }
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
