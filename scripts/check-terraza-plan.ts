import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const r = await db.restaurant.findFirst({
    where: { slug: "terraza-alameda" },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true, isDemo: true },
  });
  console.log(JSON.stringify(r, null, 2));
}
main().catch(console.error).finally(() => db.$disconnect());
