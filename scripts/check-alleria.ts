import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const r = await p.restaurant.findFirst({
    where: { name: { contains: "alleria", mode: "insensitive" } },
    select: { id: true, name: true, slug: true, plan: true, subscriptionStatus: true, billingExempt: true, trialEndsAt: true, flowSubscriptionId: true, owner: { select: { name: true, email: true, whatsapp: true } } },
  });
  console.log(JSON.stringify(r, null, 2));
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
