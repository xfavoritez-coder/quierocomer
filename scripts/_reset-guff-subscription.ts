import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "guff", mode: "insensitive" } },
    select: { id: true, name: true, flowSubscriptionId: true, flowPlanId: true, flowCustomerId: true },
  });
  if (!r) { console.log("No encontrado"); return; }
  console.log("Antes:", r);
  await prisma.restaurant.update({
    where: { id: r.id },
    data: {
      flowSubscriptionId: null,
      flowCustomerId: null,
      flowPlanId: null,
    },
  });
  console.log(`✅ ${r.name}: datos de suscripción Flow limpiados`);
  await prisma.$disconnect();
}
main();
