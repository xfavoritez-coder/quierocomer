import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "oveja", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!r) { console.log("No encontrado"); return; }

  const updated = await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      currentPeriodEnd: new Date("2026-10-28T15:22:01.237Z"),
      subscriptionStatus: "ACTIVE",
      isActive: true,
    },
    select: { name: true, currentPeriodEnd: true, subscriptionStatus: true, isActive: true },
  });
  console.log("✅ Corregido:", JSON.stringify(updated, null, 2));
  await prisma.$disconnect();
}
main().catch(console.error);
