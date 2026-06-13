import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find the restaurant
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "el-parron-de-pomaire" },
    select: { id: true, name: true, slug: true },
  });

  if (!restaurant) {
    console.error("Restaurant 'el-parron-de-pomaire' not found.");
    return;
  }

  console.log(`Found restaurant: ${restaurant.name} (id: ${restaurant.id})`);

  // Find all dishes for this restaurant
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id },
    select: { id: true, name: true, photos: true },
  });

  console.log(`Total dishes: ${dishes.length}`);

  // Filter dishes that have at least one drive.google.com photo
  const dishesWithDrivePhotos = dishes.filter((dish) => {
    const photos = dish.photos as string[];
    return Array.isArray(photos) && photos.some((p) => p.includes("drive.google.com"));
  });

  console.log(`Dishes with drive.google.com photos: ${dishesWithDrivePhotos.length}`);

  if (dishesWithDrivePhotos.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  // Clear photos for each dish with drive.google.com URLs
  let updatedCount = 0;
  for (const dish of dishesWithDrivePhotos) {
    const photos = dish.photos as string[];
    const driveUrls = photos.filter((p) => p.includes("drive.google.com"));

    console.log(`\nUpdating dish: "${dish.name}" (id: ${dish.id})`);
    console.log(`  Drive URLs to remove (${driveUrls.length}):`);
    for (const url of driveUrls) {
      console.log(`    - ${url}`);
    }

    // Keep any non-drive photos, clear drive ones
    const remainingPhotos = photos.filter((p) => !p.includes("drive.google.com"));

    await prisma.dish.update({
      where: { id: dish.id },
      data: { photos: remainingPhotos },
    });

    console.log(`  photos set to: [${remainingPhotos.length === 0 ? "empty" : remainingPhotos.join(", ")}]`);
    updatedCount++;
  }

  console.log(`\nDone. Updated ${updatedCount} dish(es).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
