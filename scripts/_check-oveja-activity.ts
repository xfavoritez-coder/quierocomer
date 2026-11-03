import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "oveja", mode: "insensitive" } },
    select: { id: true },
  });
  if (!r) return;
  const logs = await prisma.panelActivity.findMany({
    where: { restaurantId: r.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { action: true, details: true, createdAt: true },
  });
  console.log(JSON.stringify(logs, null, 2));
  await prisma.$disconnect();
}
main();
