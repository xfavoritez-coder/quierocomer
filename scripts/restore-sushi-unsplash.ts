import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "sushi-austral" },
    select: { id: true, name: true },
  });
  if (!restaurant) { console.error("Not found!"); return; }

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, photos: { isEmpty: true } },
    select: { id: true, name: true },
    orderBy: { position: "asc" },
  });

  console.log(`${dishes.length} dishes need photos`);

  if (!process.env.UNSPLASH_ACCESS_KEY) {
    console.error("No UNSPLASH_ACCESS_KEY");
    return;
  }

  const { searchUnsplashPhoto, triggerUnsplashDownload } = await import("../src/lib/unsplash");

  for (const dish of dishes) {
    try {
      const photo = await searchUnsplashPhoto(`${dish.name} sushi food`);
      if (photo) {
        await prisma.dish.update({
          where: { id: dish.id },
          data: {
            photos: [photo.rawUrl],
            isPhotoReferential: true,
            photoCredits: [{ photographer: photo.photographer, profileUrl: photo.profileUrl, unsplashId: photo.unsplashId }],
          },
        });
        triggerUnsplashDownload(photo.downloadLocation).catch(() => {});
        console.log(`✓ ${dish.name}: ${photo.photographer}`);
      } else {
        console.log(`✗ ${dish.name}: no photo found`);
      }
    } catch (e: any) {
      console.error(`✗ ${dish.name}: ${e.message}`);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
