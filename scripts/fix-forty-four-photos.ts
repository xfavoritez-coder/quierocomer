import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();

  const rest = await p.restaurant.findFirst({
    where: { slug: "forty-four" },
    select: { id: true, name: true, isDemo: true },
  });

  if (!rest) { console.log("Restaurant not found"); await p.$disconnect(); return; }
  console.log(`Restaurant: ${rest.name} | isDemo: ${rest.isDemo}`);

  // Count dishes with photos
  const withPhotos = await p.dish.count({
    where: { restaurantId: rest.id, NOT: { photos: { equals: [] } } },
  });
  console.log(`Dishes with photos: ${withPhotos}`);

  // Clear all photos (they were all added by the pipeline)
  const result = await p.dish.updateMany({
    where: { restaurantId: rest.id, NOT: { photos: { equals: [] } } },
    data: { photos: [], isPhotoReferential: false, photoCredits: [] },
  });

  console.log(`Cleared photos from ${result.count} dishes`);
  await p.$disconnect();
}

main().catch(console.error);
