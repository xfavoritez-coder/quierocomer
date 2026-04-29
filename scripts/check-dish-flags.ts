import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const dishes = await p.dish.findMany({
    where: { restaurant: { slug: "horusvegan" }, name: { in: ["Manglar", "11:11"] } },
    select: { name: true, tags: true, isHighMargin: true, isFeaturedAuto: true, createdAt: true, dishDiet: true },
  });
  console.log(JSON.stringify(dishes, null, 2));
  await p.$disconnect();
}
main();
