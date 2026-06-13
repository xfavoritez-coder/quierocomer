import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const count = await db.dish.count({
    where: { restaurant: { slug: "la-picada-del-pa-vito" }, deletedAt: null },
  });
  console.log("Platos:", count);
}
main().catch(console.error).finally(() => db.$disconnect());
