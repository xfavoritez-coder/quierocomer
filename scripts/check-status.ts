import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  for (const slug of ["wena-pizza", "sushi-austral"]) {
    const r = await prisma.restaurant.findUnique({
      where: { slug },
      select: {
        id: true, isActive: true, isDemo: true, plan: true,
        subscriptionStatus: true, needsTranslation: true,
        menuImported: true, demoOnboardingDone: true,
        defaultView: true, cartaColorMode: true, cartaTheme: true,
      },
    });
    console.log(`\n${slug}:`, JSON.stringify(r, null, 2));
    if (r) {
      const dishes = await prisma.dish.count({ where: { restaurantId: r.id, isActive: true, deletedAt: null } });
      const cats = await prisma.category.count({ where: { restaurantId: r.id, isActive: true } });
      const withPhotos = await prisma.dish.count({ where: { restaurantId: r.id, isActive: true, photos: { isEmpty: false } } });
      console.log(`  active dishes: ${dishes}, active cats: ${cats}, with photos: ${withPhotos}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
