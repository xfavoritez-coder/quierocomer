import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const restId = "cmpvf8iop0001l804y52bod3d";
  
  // Clear all current RECOMMENDED tags
  const allDishes = await db.dish.findMany({
    where: { restaurantId: restId, isActive: true, deletedAt: null },
    select: { id: true, name: true, tags: true, photos: true },
  });
  
  const currentRecs = allDishes.filter(d => d.tags?.includes("RECOMMENDED"));
  console.log("Recomendados actuales:", currentRecs.map(d => `${d.name} (foto: ${!!d.photos?.[0]})`));
  
  // Clear all
  for (const d of currentRecs) {
    await db.dish.update({
      where: { id: d.id },
      data: { tags: (d.tags || []).filter(t => t !== "RECOMMENDED"), isHero: false },
    });
  }
  
  // Pick 3 best dishes with photos
  const withPhoto = allDishes.filter(d => d.photos?.[0]);
  console.log(`\nPlatos con foto: ${withPhoto.length}`);
  
  // Pick diverse ones (different names/types)
  const candidates = withPhoto.slice(0, 20);
  console.log("\nCandidatos:");
  candidates.forEach(d => console.log(`  - ${d.name}`));
  
  // Select 3 good-looking ones
  const selected = withPhoto.filter(d => 
    !d.name.toLowerCase().includes("bebida") &&
    !d.name.toLowerCase().includes("agua") &&
    !d.name.toLowerCase().includes("jugo")
  ).slice(0, 3);
  
  console.log("\nSeleccionados:");
  for (const d of selected) {
    await db.dish.update({
      where: { id: d.id },
      data: { tags: [...(d.tags || []), "RECOMMENDED"], isHero: true },
    });
    console.log(`  ★ ${d.name} (${d.photos?.[0]?.slice(0, 60)}...)`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
