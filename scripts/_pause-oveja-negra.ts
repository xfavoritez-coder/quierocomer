import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  // Sept 22 = 6 days ago, past the 5-day grace window → carta se muestra pausada
  const sept22 = new Date("2026-09-22T12:00:00.000Z");
  // Payment token from the manual link we sent them
  const paymentToken = "E89F2006FE05EF3F8E6B6D0F5B51AFB2C3F7245W";

  const found = await prisma.restaurant.findFirst({
    where: { name: { contains: "oveja", mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (!found) { console.log("No encontrado"); return; }
  console.log(`Encontrado: ${found.name}`);

  const r = await prisma.restaurant.update({
    where: { id: found.id },
    data: {
      currentPeriodEnd: sept22,
      flowRegisterToken: paymentToken,
    },
    select: { name: true, currentPeriodEnd: true, flowRegisterToken: true, subscriptionStatus: true },
  });
  console.log("✅ La Oveja Negra pausada:");
  console.log(`   currentPeriodEnd: ${r.currentPeriodEnd?.toLocaleDateString("es-CL")}`);
  console.log(`   flowRegisterToken: ${r.flowRegisterToken}`);
  console.log(`   subscriptionStatus: ${r.subscriptionStatus}`);
  await prisma.$disconnect();
}
main().catch(console.error);
