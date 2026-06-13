import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const r = await db.restaurant.findUnique({
    where: { slug: "fogon-del-puerto" },
    select: {
      id: true, name: true, plan: true, subscriptionStatus: true,
      mpSubscriptionId: true, mpPlanId: true, mpCustomerId: true,
      pendingMpPlanId: true, currentPeriodEnd: true, lastPaymentAt: true,
      trialEndsAt: true, billingExempt: true,
    },
  });
  console.log(JSON.stringify(r, null, 2));
}
main().catch(console.error).finally(() => db.$disconnect());
