import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "oveja", mode: "insensitive" } },
    select: {
      id: true, name: true, plan: true, subscriptionStatus: true,
      currentPeriodEnd: true, lastPaymentAt: true,
      flowSubscriptionId: true, flowCustomerId: true, flowPlanId: true,
      pendingFlowPlanId: true, isActive: true,
    },
  });
  console.log(JSON.stringify(r, null, 2));
  await prisma.$disconnect();
}
main();
