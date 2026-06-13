import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const restId = "cmpvf8iop0001l804y52bod3d";
  
  // Clear all RECOMMENDED
  await db.dish.updateMany({
    where: { restaurantId: restId, tags: { has: "RECOMMENDED" } },
    data: { isHero: false },
  });
  const recs = await db.dish.findMany({
    where: { restaurantId: restId, tags: { has: "RECOMMENDED" } },
    select: { id: true, tags: true },
  });
  for (const d of recs) {
    await db.dish.update({
      where: { id: d.id },
      data: { tags: (d.tags || []).filter(t => t !== "RECOMMENDED") },
    });
  }
  
  // Pick 3 diverse dishes with photos
  const picks = [
    "Ceviche Premium Atun",
    "Costillas de Cerdo a lo Pobre", 
    "Pastel Jaiva Camarón",
  ];
  
  for (const name of picks) {
    const d = await db.dish.findFirst({
      where: { restaurantId: restId, name, isActive: true, deletedAt: null },
    });
    if (d && d.photos?.[0]) {
      await db.dish.update({
        where: { id: d.id },
        data: { tags: [...(d.tags || []), "RECOMMENDED"], isHero: true },
      });
      console.log(`★ ${d.name}`);
    } else {
      console.log(`✗ ${name} — no encontrado o sin foto`);
    }
  }
}

main().catch(console.error).finally(() => db.$disconnect());
