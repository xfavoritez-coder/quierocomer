import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findUnique({
    where: { slug: "test-autocobro" },
    select: {
      name: true, plan: true, subscriptionStatus: true,
      flowSubscriptionId: true, flowPlanId: true, flowCustomerId: true,
      currentPeriodEnd: true, lastPaymentAt: true,
    },
  });
  console.log(JSON.stringify(r, null, 2));
  await prisma.$disconnect();
}
main();
