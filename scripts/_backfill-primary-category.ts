import { config } from "dotenv";
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import { inferPrimaryCategory } from "../src/app/a/lib/categories";

const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL });

async function main() {
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, primaryCategory: true },
    orderBy: { name: 'asc' },
  });

  console.log(`Processing ${restaurants.length} restaurants...`);
  let updated = 0;
  let skipped = 0;

  for (const rest of restaurants) {
    const cats = await prisma.category.findMany({
      where: { restaurantId: rest.id, isActive: true },
      select: { name: true, cuisineTag: true, dishType: true },
    });

    const primary = inferPrimaryCategory(cats);

    if (!primary) {
      console.log(`  SKIP (no inference): ${rest.name}`);
      skipped++;
      continue;
    }

    if (rest.primaryCategory === primary) {
      skipped++;
      continue;
    }

    await prisma.restaurant.update({
      where: { id: rest.id },
      data: { primaryCategory: primary },
    });
    console.log(`  ${rest.name} → ${primary}`);
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped/unchanged`);
  await prisma.$disconnect();
}

main().catch(console.error);
