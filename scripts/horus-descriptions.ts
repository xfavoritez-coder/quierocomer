import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const dishes = await p.dish.findMany({
    where: { restaurant: { slug: "horusvegan" }, isActive: true, deletedAt: null },
    select: { name: true, description: true, category: { select: { name: true, position: true } } },
    orderBy: [{ category: { position: "asc" } }, { position: "asc" }],
  });

  for (const d of dishes) {
    console.log(`[${d.category.name}] ${d.name}`);
    console.log(`  ${d.description || "(sin descripción)"}`);
    console.log();
  }
  console.log(`Total: ${dishes.length} platos`);
  await p.$disconnect();
}
main();
