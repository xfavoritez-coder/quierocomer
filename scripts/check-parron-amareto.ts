import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Find the restaurant
  const restaurants = await prisma.restaurant.findMany({
    where: {
      OR: [
        { name: { contains: "parron", mode: "insensitive" } },
        { slug: { contains: "parron" } },
        { name: { contains: "pomaire", mode: "insensitive" } },
        { slug: { contains: "pomaire" } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      isActive: true,
      allPhotosReferential: true,
    },
  });

  console.log("Restaurants found:", restaurants.length);
  for (const r of restaurants) {
    console.log(JSON.stringify(r, null, 2));
  }

  if (restaurants.length === 0) {
    console.log("No restaurant found — stopping.");
    return;
  }

  const restaurantId = restaurants[0].id;

  // Find the "amareto sour" dish (and similar spelling variants)
  const dishes = await prisma.dish.findMany({
    where: {
      restaurantId,
      name: { contains: "amaret", mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      photos: true,
      isActive: true,
      isPhotoReferential: true,
      deletedAt: true,
      categoryId: true,
      category: { select: { name: true } },
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log("\nDishes matching 'amaret':", dishes.length);
  for (const d of dishes) {
    console.log(JSON.stringify(d, null, 2));
  }

  // Also search broadly by "sour" in case spelling differs
  const sourDishes = await prisma.dish.findMany({
    where: {
      restaurantId,
      name: { contains: "sour", mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      photos: true,
      isActive: true,
      isPhotoReferential: true,
      deletedAt: true,
    },
  });

  console.log("\nDishes matching 'sour':", sourDishes.length);
  for (const d of sourDishes) {
    console.log(JSON.stringify(d, null, 2));
  }

  // Show all dishes that have NO photos, so we can see the full picture
  const nophoto = await prisma.dish.count({
    where: { restaurantId, photos: { isEmpty: true }, deletedAt: null },
  });
  const withphoto = await prisma.dish.count({
    where: { restaurantId, NOT: { photos: { isEmpty: true } }, deletedAt: null },
  });
  console.log(`\nActive dishes: ${nophoto + withphoto} total. With photos: ${withphoto}, Without photos: ${nophoto}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
