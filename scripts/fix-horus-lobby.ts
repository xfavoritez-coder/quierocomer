import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.restaurant.update({
    where: { slug: "horusvegan" },
    data: { showCategoryLobby: false },
  });
  const r = await prisma.restaurant.findUnique({
    where: { slug: "horusvegan" },
    select: { name: true, showCategoryLobby: true },
  });
  console.log("Updated:", JSON.stringify(r));
}
main().catch(console.error).finally(() => prisma.$disconnect());
