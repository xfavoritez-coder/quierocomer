import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  for (const slug of ["horusvegan", "alleria-pizza"]) {
    const count = await prisma.dish.count({ where: { restaurant: { slug }, isActive: true } });
    const r = await prisma.restaurant.findUnique({ where: { slug }, select: { menuImported: true } });
    console.log(`${slug}: ${count} platos, menuImported=${r?.menuImported}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
