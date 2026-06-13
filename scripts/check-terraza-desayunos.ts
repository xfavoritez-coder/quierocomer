import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const cats = await db.category.findMany({
    where: { restaurantId: "cmpvf8iop0001l804y52bod3d", name: "DESAYUNOS" },
    select: { id: true },
  });
  const dishes = await db.dish.findMany({
    where: { categoryId: cats[0]?.id, isActive: true, deletedAt: null },
    select: { name: true, photos: true, description: true },
    orderBy: { position: "asc" },
  });
  for (const d of dishes) {
    console.log(`${d.photos?.[0] ? "📸" : "  "} ${d.name} — desc: ${d.description?.length || 0} chars`);
  }
}
main().catch(console.error).finally(() => db.$disconnect());
