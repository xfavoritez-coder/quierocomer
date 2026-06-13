import { PrismaClient, Prisma } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  for (const search of ["aloha", "victoria"]) {
    const rest = await p.restaurant.findFirst({
      where: { name: { contains: search, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (!rest) { console.log(`${search}: no encontrado`); continue; }

    const dishes = await p.dish.findMany({
      where: { restaurantId: rest.id },
      select: { id: true, name: true, photos: true },
    });

    const withUnsplash = dishes.filter(d => d.photos.some(p => p.includes("unsplash.com")));
    console.log(`${rest.name}: ${dishes.length} platos, ${withUnsplash.length} con unsplash`);

    for (const d of withUnsplash) {
      const clean = d.photos.filter(ph => !ph.includes("unsplash.com"));
      await p.dish.update({
        where: { id: d.id },
        data: { photos: clean, photoCredits: Prisma.DbNull, isPhotoReferential: false },
      });
      console.log(`  Limpiado: ${d.name}`);
    }
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
