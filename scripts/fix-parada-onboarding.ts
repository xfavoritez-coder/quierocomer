import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({
    where: { localName: { contains: "parada", mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
  });
  if (!lead) { console.log("Not found"); await p.$disconnect(); return; }

  await p.lead.update({
    where: { id: lead.id },
    data: {
      onboardingDoneAt: null,
      panelVisitedAt: null,
      activarVisitedAt: null,
    },
  });

  // Also reset onboarding on restaurant
  if (lead.generatedSlug) {
    await p.restaurant.updateMany({
      where: { slug: lead.generatedSlug },
      data: { demoOnboardingDone: false },
    });
  }

  console.log("Cleared onboarding, panel, activar timestamps + reset restaurant onboarding");
  await p.$disconnect();
}
main();
