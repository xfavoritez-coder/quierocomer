import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const r = await db.restaurant.findUnique({
    where: { slug: "fogon-del-puerto" },
    select: { mpSubscriptionId: true, mpPlanId: true, mpCustomerId: true, subscriptionStatus: true, plan: true, currentPeriodEnd: true },
  });
  console.log(JSON.stringify(r, null, 2));
}
main().catch(console.error).finally(() => db.$disconnect());
