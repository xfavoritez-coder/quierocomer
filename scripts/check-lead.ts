import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const query = process.argv[2] || "parada";
  const lead = await p.lead.findFirst({
    where: { localName: { contains: query, mode: "insensitive" } },
    include: { detectedProvider: { select: { name: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!lead) { console.log(`No lead found with "${query}"`); await p.$disconnect(); return; }

  console.log("Lead:", lead.localName);
  console.log("Status:", lead.cartaStatus);
  console.log("URL:", lead.cartaUrl);
  console.log("Provider:", lead.detectedProvider?.name, `(${lead.detectedProvider?.status})`);
  console.log("Slug:", lead.generatedSlug);
  console.log("Email:", lead.email);
  console.log("Owner:", lead.ownerName);
  console.log("Error:", lead.errorLog);
  console.log("Created:", lead.createdAt.toISOString());
  console.log("Delivered:", lead.deliveredAt?.toISOString() || "—");
  console.log("Opened:", lead.emailOpenedAt?.toISOString() || "—");
  console.log("Clicked:", lead.emailClickedAt?.toISOString() || "—");
  console.log("Onboarding:", lead.onboardingDoneAt?.toISOString() || "—");
  console.log("Panel:", lead.panelVisitedAt?.toISOString() || "—");
  console.log("Activar:", lead.activarVisitedAt?.toISOString() || "—");
  console.log("Activated:", lead.activatedAt?.toISOString() || "—");

  if (lead.generatedSlug) {
    const rest = await p.restaurant.findFirst({ where: { slug: lead.generatedSlug }, select: { id: true, name: true, isDemo: true, plan: true } });
    if (rest) {
      const dishCount = await p.dish.count({ where: { restaurantId: rest.id } });
      const catCount = await p.category.count({ where: { restaurantId: rest.id } });
      console.log(`\nRestaurant: ${rest.name} | demo: ${rest.isDemo} | plan: ${rest.plan}`);
      console.log(`  ${dishCount} platos, ${catCount} categorías`);
    }
  }

  if (lead.events && Array.isArray(lead.events) && lead.events.length > 0) {
    console.log(`\nEvents (${lead.events.length}):`);
    for (const e of (lead.events as any[]).slice(-10)) {
      console.log(`  ${e.action} ${e.ts || ""}`);
    }
  }

  await p.$disconnect();
}
main();
