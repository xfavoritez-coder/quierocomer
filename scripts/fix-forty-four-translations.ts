import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const rest = await p.restaurant.findFirst({
    where: { slug: "forty-four" },
    select: { id: true, name: true, needsTranslation: true, enabledLangs: true },
  });
  if (!rest) { console.log("Not found"); await p.$disconnect(); return; }

  console.log(`Restaurant: ${rest.name}`);
  console.log(`enabledLangs: ${rest.enabledLangs}`);
  console.log(`needsTranslation: ${rest.needsTranslation}`);

  const translationCount = await p.dishTranslation.count({
    where: { dish: { restaurantId: rest.id } },
  });
  const dishCount = await p.dish.count({ where: { restaurantId: rest.id } });

  console.log(`Dishes: ${dishCount}`);
  console.log(`Translations: ${translationCount}`);

  if (translationCount === 0) {
    console.log("\nNo translations found. Triggering full translation...");
    const { translateAllForRestaurant } = await import("../src/lib/ai/translateContent");
    await translateAllForRestaurant(rest.id);
    await p.restaurant.update({ where: { id: rest.id }, data: { needsTranslation: false } });

    const newCount = await p.dishTranslation.count({
      where: { dish: { restaurantId: rest.id } },
    });
    console.log(`Done! New translation count: ${newCount}`);
  }

  await p.$disconnect();
}

main().catch(console.error);
