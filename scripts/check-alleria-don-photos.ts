import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: "alleria-pizza" } });
  if (!r) return;
  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null, isActive: true, name: { in: ["Don Ricardo", "Don Marocchino", "Cannolis 2 Sabores"] } },
    select: { id: true, name: true, photos: true },
  });
  for (const d of dishes) {
    console.log(`${d.name}: ${d.photos.length} fotos`);
    for (const p of d.photos) console.log(`  ${p}`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
