import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const resto = await db.restaurant.findUnique({
    where: { slug: "fogon-del-puerto" },
    select: { id: true, name: true, isDemo: true, plan: true, subscriptionStatus: true, trialEndsAt: true, trialReminderSentAt: true, createdAt: true },
  });
  console.log("Restaurant:", JSON.stringify(resto, null, 2));

  const lead = await db.lead.findFirst({
    where: { generatedSlug: "fogon-del-puerto" },
    select: { id: true, email: true, ownerName: true, whatsapp: true, activated: true, activatedAt: true, panelVisitedAt: true, onboardingDoneAt: true, deliveredAt: true, events: true, cartaStatus: true },
  });
  console.log("\nLead:", JSON.stringify(lead, null, 2));
}

main().catch(console.error).finally(() => db.$disconnect());
