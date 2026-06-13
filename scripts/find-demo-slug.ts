import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const r = await p.restaurant.findFirst({
    where: { isDemo: true },
    select: { slug: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  console.log("Demo:", r);
  await p.$disconnect();
}
main();
