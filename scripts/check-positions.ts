import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const dishes = await p.dish.findMany({
    where: { restaurant: { slug: "horusvegan" }, category: { name: "Para compartir" }, isActive: true, deletedAt: null },
    select: { name: true, position: true, tags: true },
    orderBy: { position: "asc" },
  });
  console.log("Para compartir — orden por position:");
  for (const d of dishes) {
    console.log(`  pos=${d.position} | ${d.name} ${d.tags.length ? `[${d.tags.join(",")}]` : ""}`);
  }
  await p.$disconnect();
}
main();
