import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// New categories and dishes extracted from OlaClick
const newCategories = [
  {
    name: "Handrolls",
    dishes: [
      { name: "Handrolls de pollo", description: "Handroll con relleno de pollo, queso crema y cebollín", price: 3500 },
      { name: "Handrolls de Kanikama", description: "Handroll con relleno de kanikama, queso crema y cebollín", price: 3500 },
      { name: "Handrolls de salmón", description: "Handroll con relleno de salmón, queso crema y cebollín", price: 3500 },
      { name: "Handrolls de camarón", description: "Handroll con relleno de camarón, queso crema y cebollín", price: 3500 },
      { name: "Handrolls vegetariano", description: "Handroll con relleno de palmito, queso crema y choclo", price: 3500 },
    ],
  },
  {
    name: "Gohan",
    dishes: [
      { name: "Gohan Furay", description: "Preparación en base de arroz, cubierto de camarón furay, trozos de salmón en panco, pollo apanado, palta, queso crema, ciboulette y sésamo", price: 10999 },
      { name: "Gohan de los mares", description: "Preparación en base de arroz, cubierto de salmón, atún, camarón, palta, queso crema, ciboulette y sésamo", price: 10990 },
      { name: "Gohan vegetariano", description: "Preparación en base de arroz, cubierto con una rosa de palta, cebollín, queso crema, palmitos, choclitos y champiñones furay", price: 10990 },
    ],
  },
  {
    name: "Especiales",
    dishes: [
      { name: "Dragon Roll", description: "Roll envuelto con salmón premium, relleno de camarones furay, queso crema y palta, todo con una salsa specy picante y un toque de merkén ahumado", price: 7500 },
      { name: "Roll Pap Hilo", description: "Avocado roll, con relleno simple de pollo furay y queso crema. Todo debajo de delicadas papas hilo", price: 7500 },
      { name: "Dinamita Rolls", description: "", price: 9000 },
    ],
  },
];

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "sushi-austral" },
    select: { id: true, name: true },
  });
  if (!restaurant) { console.error("Not found!"); return; }

  // Get current max category position
  const lastCat = await prisma.category.findFirst({
    where: { restaurantId: restaurant.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  let catPosition = (lastCat?.position ?? -1) + 1;

  console.log(`Adding categories to ${restaurant.name} starting at position ${catPosition}\n`);

  for (const catData of newCategories) {
    // Check if category already exists
    const existing = await prisma.category.findFirst({
      where: { restaurantId: restaurant.id, name: catData.name },
    });
    if (existing) {
      console.log(`Category "${catData.name}" already exists, skipping`);
      continue;
    }

    const category = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        name: catData.name,
        position: catPosition++,
        dishType: "food",
        isActive: true,
      },
    });
    console.log(`✓ Created category: ${catData.name} (position ${category.position})`);

    for (let j = 0; j < catData.dishes.length; j++) {
      const d = catData.dishes[j];
      const dish = await prisma.dish.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: category.id,
          name: d.name,
          description: d.description || null,
          price: d.price,
          photos: [],
          position: j,
          dishDiet: "OMNIVORE",
          isActive: true,
        },
      });
      console.log(`  + ${d.name}: $${d.price}`);
    }
  }

  // Add Unsplash photos to new dishes without photos
  console.log("\nAdding Unsplash photos to new dishes...");
  if (!process.env.UNSPLASH_ACCESS_KEY) {
    console.error("No UNSPLASH_ACCESS_KEY, skipping photos");
  } else {
    const { searchUnsplashPhoto, triggerUnsplashDownload } = await import("../src/lib/unsplash");
    const dishesNoPhotos = await prisma.dish.findMany({
      where: { restaurantId: restaurant.id, photos: { isEmpty: true } },
      select: { id: true, name: true },
    });

    for (const dish of dishesNoPhotos) {
      const query = dish.name.toLowerCase().includes("handroll") ? "hand roll sushi"
        : dish.name.toLowerCase().includes("gohan") ? "sushi rice bowl gohan"
        : dish.name.toLowerCase().includes("dragon") ? "dragon roll sushi"
        : dish.name.toLowerCase().includes("dinamita") ? "deep fried sushi roll"
        : `${dish.name} sushi food`;
      try {
        const photo = await searchUnsplashPhoto(query);
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
          console.log(`  📷 ${dish.name}: ${photo.photographer}`);
        } else {
          console.log(`  ✗ ${dish.name}: no photo found`);
        }
      } catch (e: any) {
        console.error(`  ✗ ${dish.name}: ${e.message}`);
      }
    }
  }

  // Final count
  const totalDishes = await prisma.dish.count({ where: { restaurantId: restaurant.id } });
  const withPhotos = await prisma.dish.count({ where: { restaurantId: restaurant.id, photos: { isEmpty: false } } });
  const totalCats = await prisma.category.count({ where: { restaurantId: restaurant.id } });
  console.log(`\n✓ Done! ${restaurant.name}: ${totalCats} categories, ${totalDishes} dishes, ${withPhotos} with photos`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
