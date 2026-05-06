import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: "hand-roll" } });
  if (!r) return;
  // DishSuggestion: dish (origin) + suggestedDish (target)
  const sugs = await prisma.dishSuggestion.findMany({
    where: { dish: { restaurantId: r.id } },
    include: {
      dish: { select: { name: true, photos: true } },
      suggestedDish: { select: { name: true, photos: true, isActive: true, deletedAt: true } },
    },
    take: 50,
  });
  console.log(`Total suggestions Hand Roll: ${sugs.length}`);
  let badPhotos = 0;
  let inactive = 0;
  let deleted = 0;
  for (const s of sugs) {
    const hasPhoto = s.suggestedDish.photos.length > 0 && s.suggestedDish.photos[0];
    if (!hasPhoto) badPhotos++;
    if (!s.suggestedDish.isActive) inactive++;
    if (s.suggestedDish.deletedAt) deleted++;
  }
  console.log(`Sugerencias hacia plato sin foto: ${badPhotos}`);
  console.log(`Sugerencias hacia plato inactivo: ${inactive}`);
  console.log(`Sugerencias hacia plato deleted: ${deleted}`);

  // Sample
  console.log("\nMuestra primeras 10:");
  for (const s of sugs.slice(0, 10)) {
    const photo = s.suggestedDish.photos[0] || "[NO PHOTO]";
    const flags = [
      !s.suggestedDish.isActive ? "INACTIVE" : "",
      s.suggestedDish.deletedAt ? "DELETED" : "",
    ].filter(Boolean).join(",");
    console.log(`  ${s.dish.name} → ${s.suggestedDish.name}${flags ? ` {${flags}}` : ""} | photo: ${photo.substring(0, 50)}`);
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect(); });
