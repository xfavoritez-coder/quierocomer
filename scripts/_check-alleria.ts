import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const r = await prisma.restaurant.findFirst({
    where: { name: { contains: "alleria", mode: "insensitive" } },
    select: { name: true, plan: true, flowPlanId: true, flowSubscriptionId: true, customPlanPriceNet: true, currentPeriodEnd: true },
  });
  console.log(JSON.stringify(r, null, 2));
  await prisma.$disconnect();
}
main();
