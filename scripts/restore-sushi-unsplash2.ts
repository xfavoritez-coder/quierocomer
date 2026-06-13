import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "sushi-austral" },
    select: { id: true },
  });
  if (!restaurant) return;

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, photos: { isEmpty: true } },
    select: { id: true, name: true },
  });

  console.log(`${dishes.length} dishes still need photos`);
  if (dishes.length === 0) return;

  const { searchUnsplashPhoto, triggerUnsplashDownload } = await import("../src/lib/unsplash");

  for (const dish of dishes) {
    try {
      // Try generic sushi terms
      const photo = await searchUnsplashPhoto("sushi platter Japanese food");
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
        console.log(`✗ ${dish.name}: still no photo`);
      }
    } catch (e: any) {
      console.error(`✗ ${dish.name}: ${e.message}`);
    }
  }
  console.log("Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
