import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: "alleria-pizza" } });
  if (!r) return;
  const cafe = await prisma.category.findFirst({ where: { restaurantId: r.id, name: "Cafetería" } });
  if (!cafe) return;
  const dishes = await prisma.dish.findMany({
    where: { categoryId: cafe.id, deletedAt: null },
    select: { id: true, name: true, photos: true, price: true },
    orderBy: { position: "asc" },
  });
  for (const d of dishes) {
    console.log(`${d.name} ($${d.price}): ${d.photos.length} fotos${d.photos[0] ? " — " + d.photos[0].substring(0, 80) : ""}`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
