import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  for (const slug of ["horusvegan", "alleria-pizza"]) {
    const r = await prisma.restaurant.findUnique({
      where: { slug },
      select: { name: true, isDemo: true, plan: true, subscriptionStatus: true },
    });
    console.log(`${slug}: isDemo=${r?.isDemo}, plan=${r?.plan}, status=${r?.subscriptionStatus}`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
