import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const rs = await prisma.restaurant.findMany({
    where: { flowPlanId: "qc_premium_monthly" },
    select: { id: true, name: true, subscriptionStatus: true, currentPeriodEnd: true, lastPaymentAt: true },
  });
  console.log(JSON.stringify(rs, null, 2));
  console.log(`Total: ${rs.length}`);
  await prisma.$disconnect();
}
main();
