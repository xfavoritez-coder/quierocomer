import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  await db.restaurant.update({
    where: { slug: "fogon-del-puerto" },
    data: {
      subscriptionStatus: "NONE",
      plan: "FREE",
      trialEndsAt: null,
      trialReminderSentAt: null,
    },
  });

  const r = await db.restaurant.findUnique({
    where: { slug: "fogon-del-puerto" },
    select: { name: true, plan: true, subscriptionStatus: true, trialEndsAt: true, isDemo: true },
  });
  console.log("✓ Downgrade completo:", JSON.stringify(r, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());
