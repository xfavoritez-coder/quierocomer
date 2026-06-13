import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const cats = await db.category.findMany({
    where: { restaurantId: "cmpvf8iop0001l804y52bod3d", isActive: true },
    orderBy: { position: "asc" },
    select: { id: true, name: true, position: true, description: true, _count: { select: { dishes: { where: { isActive: true, deletedAt: null } } } } },
  });
  for (const c of cats) {
    console.log(`${c.position}. ${c.name} — ${c._count.dishes} platos${c.description ? ` (desc: "${c.description}")` : ""}`);
  }
}
main().catch(console.error).finally(() => db.$disconnect());
