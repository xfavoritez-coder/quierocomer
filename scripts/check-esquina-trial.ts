import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const r = await p.restaurant.findFirst({
    where: { name: { contains: "Menú de la Esquina", mode: "insensitive" } },
    select: { id: true, name: true, plan: true, subscriptionStatus: true, trialEndsAt: true, trialReminderSentAt: true, owner: { select: { name: true, email: true } } },
  });
  console.log("Restaurant:", JSON.stringify(r, null, 2));
  const now = new Date();
  if (r?.trialEndsAt) {
    const daysLeft = Math.ceil((r.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    console.log(`\nDías restantes de trial: ${daysLeft}`);
    console.log(`trialReminderSentAt: ${r.trialReminderSentAt}`);
    console.log(`Califica para reminder (<=2 días, no enviado): ${daysLeft <= 2 && !r.trialReminderSentAt}`);
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
