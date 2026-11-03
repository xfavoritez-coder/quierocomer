import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const plans = ["qc_basic_monthly", "qc_gold_monthly", "qc_monthly", "qc_premium_monthly"];
  for (const planId of plans) {
    const rs = await prisma.restaurant.findMany({
      where: { flowPlanId: planId },
      select: { name: true, subscriptionStatus: true },
    });
    console.log(`${planId}: ${rs.length} locales`);
    rs.forEach(r => console.log(`  - ${r.name} (${r.subscriptionStatus})`));
  }
  await prisma.$disconnect();
}
main();
