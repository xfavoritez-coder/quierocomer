import { PrismaClient, Prisma } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const rests = await p.restaurant.findMany({
    where: { name: { contains: "victoria", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  console.log("Found:", rests.map(r => r.name).join(", ") || "ninguno");

  for (const rest of rests) {
    if (!rest.name.toLowerCase().includes("sal")) continue; // Only "Salón de té"
    const dishes = await p.dish.findMany({
      where: { restaurantId: rest.id, photos: { isEmpty: false } },
      select: { id: true, name: true, photos: true },
    });
    console.log(`\n${rest.name}: ${dishes.length} platos con fotos`);
    for (const d of dishes) {
      await p.dish.update({
        where: { id: d.id },
        data: { photos: [], photoCredits: Prisma.DbNull, isPhotoReferential: false },
      });
      console.log(`  Limpiado: ${d.name} (tenia: ${d.photos.length} fotos)`);
    }
  }

  // Try broader search
  const all = await p.restaurant.findMany({
    where: { OR: [{ name: { contains: "victoria sal", mode: "insensitive" } }, { name: { contains: "salon de te", mode: "insensitive" } }, { name: { contains: "salón de té", mode: "insensitive" } }] },
    select: { id: true, name: true },
  });
  for (const rest of all) {
    const dishes = await p.dish.findMany({
      where: { restaurantId: rest.id, photos: { isEmpty: false } },
      select: { id: true, name: true, photos: true },
    });
    if (dishes.length === 0) continue;
    console.log(`\n${rest.name}: ${dishes.length} platos con fotos`);
    for (const d of dishes) {
      await p.dish.update({
        where: { id: d.id },
        data: { photos: [], photoCredits: Prisma.DbNull, isPhotoReferential: false },
      });
      console.log(`  Limpiado: ${d.name}`);
    }
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
