import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  await db.restaurant.update({
    where: { slug: "fogon-del-puerto" },
    data: { trialReminderSentAt: new Date("2026-06-02T21:00:00Z") },
  });
  const r = await db.restaurant.findUnique({
    where: { slug: "fogon-del-puerto" },
    select: { trialEndsAt: true, trialReminderSentAt: true, subscriptionStatus: true, plan: true },
  });
  console.log("✓ Marcado:", JSON.stringify(r, null, 2));
}
main().catch(console.error).finally(() => db.$disconnect());
