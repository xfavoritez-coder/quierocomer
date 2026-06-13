import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findUnique({
    where: { slug: "horusvegan" },
    select: { name: true, showCategoryLobby: true, defaultView: true },
  });
  console.log(JSON.stringify(r));
}
main().catch(console.error).finally(() => prisma.$disconnect());
