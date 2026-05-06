import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.restaurant.findFirst({ where: { slug: "hand-roll" } });
  if (!r) return;
  const cats = await prisma.category.findMany({ where: { restaurantId: r.id }, orderBy: { position: "asc" } });
  for (const c of cats) {
    const count = await prisma.dish.count({ where: { categoryId: c.id, deletedAt: null, isActive: true } });
    const withPhoto = await prisma.dish.count({ where: { categoryId: c.id, deletedAt: null, isActive: true, NOT: { photos: { isEmpty: true } } } });
    console.log(`${c.name} <${c.dishType}>: ${count} platos, ${withPhoto} con foto`);
  }
}

main().then(() => prisma.$disconnect()).catch(() => prisma.$disconnect());
