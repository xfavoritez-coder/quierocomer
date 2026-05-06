import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { OR: [{ slug: "handroll" }, { slug: { contains: "hand" } }, { name: { contains: "Hand", mode: "insensitive" } }] },
  });
  if (!r) { console.log("Hand Roll no encontrado"); return; }
  console.log(`Restaurant: ${r.name} (slug: ${r.slug})`);

  const dishes = await prisma.dish.findMany({
    where: { restaurantId: r.id, deletedAt: null, isActive: true },
    select: { id: true, name: true, photos: true, isActive: true, category: { select: { name: true, dishType: true } } },
    orderBy: { name: "asc" },
  });

  console.log(`Total platos activos: ${dishes.length}`);
  const withPhotos = dishes.filter(d => d.photos.length > 0);
  const withoutPhotos = dishes.filter(d => d.photos.length === 0);
  console.log(`Con fotos: ${withPhotos.length}`);
  console.log(`Sin fotos: ${withoutPhotos.length}`);

  console.log("\n--- Platos SIN foto ---");
  for (const d of withoutPhotos.slice(0, 30)) {
    console.log(`  [${d.category.name}<${d.category.dishType}>] ${d.name}`);
  }
  if (withoutPhotos.length > 30) console.log(`  ... y ${withoutPhotos.length - 30} más`);

  console.log("\n--- Sample con foto ---");
  for (const d of withPhotos.slice(0, 5)) {
    console.log(`  ${d.name}: ${d.photos[0].substring(0, 80)}`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
