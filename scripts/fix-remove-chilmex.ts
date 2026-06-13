import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  // Remove Chilmex from this owner (set ownerId to null)
  await db.restaurant.update({
    where: { id: "cmpwtmx1o0000js043fylj5zc" }, // Chilmex
    data: { ownerId: null },
  });
  console.log("✓ Chilmex desvinculado del owner");

  // Verify
  const owner = await db.restaurantOwner.findUnique({
    where: { email: "favoritez@gmail.com" },
    include: { restaurants: { select: { name: true, slug: true } } },
  });
  console.log("Restaurantes del owner:", JSON.stringify(owner?.restaurants, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());
