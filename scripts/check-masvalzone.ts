import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: "il-mascalzone" },
    select: { id: true, slug: true, name: true, defaultView: true, cartaTheme: true },
  });

  if (!restaurant) {
    console.log("❌ No se encontró restaurante con 'masvalzone'");
    return;
  }

  console.log("🍕 Restaurante:", restaurant);

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: restaurant.id, isActive: true, deletedAt: null },
    select: { id: true, name: true, tags: true, photos: true, isHero: true, position: true, categoryId: true },
    orderBy: { position: "asc" },
  });

  const recommended = dishes.filter((d) => d.tags.includes("RECOMMENDED"));
  console.log(`\n⭐ Platos RECOMMENDED (${recommended.length}):`);
  for (const d of recommended) {
    console.log(`  - ${d.name} | photos: ${d.photos.length > 0 ? d.photos[0].substring(0, 60) + "..." : "❌ SIN FOTO"} | isHero: ${d.isHero}`);
  }

  const withPhotos = dishes.filter((d) => d.photos.length > 0);
  console.log(`\n📷 Total platos: ${dishes.length}, con foto: ${withPhotos.length}`);

  const heroEligible = recommended.filter((d) => d.photos.length > 0);
  console.log(`\n🎯 Elegibles para hero (RECOMMENDED + foto): ${heroEligible.length}`);
  for (const d of heroEligible) {
    console.log(`  - ${d.name}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
