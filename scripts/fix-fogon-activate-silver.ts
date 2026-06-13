import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.restaurant.update({
    where: { slug: "fogon-del-puerto" },
    data: {
      plan: "SILVER",
      subscriptionStatus: "ACTIVE",
      mpPlanId: "qc_silver_monthly",
      currentPeriodEnd: periodEnd,
      lastPaymentAt: new Date(),
      pendingMpPlanId: null,
    },
  });
  console.log("✓ Silver activado, período hasta:", periodEnd.toISOString().slice(0, 10));
}
main().catch(console.error).finally(() => db.$disconnect());
