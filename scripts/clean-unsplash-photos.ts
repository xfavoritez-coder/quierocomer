import { PrismaClient, Prisma } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const dishes = await p.$queryRaw`
    SELECT id, photos FROM "Dish"
    WHERE EXISTS (SELECT 1 FROM unnest(photos) p WHERE p LIKE '%unsplash.com%')
  ` as { id: string; photos: string[] }[];

  console.log(`Found ${dishes.length} dishes with unsplash photos`);

  let count = 0;
  for (const d of dishes) {
    const clean = d.photos.filter(p => !p.includes("unsplash.com"));
    await p.dish.update({
      where: { id: d.id },
      data: { photos: clean, photoCredits: Prisma.DbNull, isPhotoReferential: false },
    });
    count++;
  }
  console.log(`Cleaned ${count} dishes`);
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
