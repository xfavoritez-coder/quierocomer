import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const rest = await p.restaurant.findFirst({
    where: { name: { contains: "aloha", mode: "insensitive" } },
    select: { id: true, name: true, slug: true, plan: true, subscriptionStatus: true, createdAt: true, owner: { select: { name: true, whatsapp: true, lastLoginAt: true } } },
  });
  if (!rest) { console.log("No encontrado"); await p.$disconnect(); return; }
  console.log("Restaurant:", rest.name, "| plan:", rest.plan, "| status:", rest.subscriptionStatus);
  console.log("Owner:", rest.owner?.name, "| wa:", rest.owner?.whatsapp, "| lastLogin:", rest.owner?.lastLoginAt);
  console.log("Created:", rest.createdAt.toISOString());
  console.log("Slug:", rest.slug);

  const lead = await p.lead.findFirst({
    where: { generatedSlug: rest.slug },
    select: { id: true, ownerName: true, whatsapp: true, cartaStatus: true, activatedAt: true, emailClickedAt: true, whatsappClickedAt: true, panelVisitedAt: true },
  });
  if (lead) {
    console.log("\nLead found:");
    console.log("  ownerName:", lead.ownerName);
    console.log("  whatsapp:", lead.whatsapp);
    console.log("  cartaStatus:", lead.cartaStatus);
    console.log("  activated:", lead.activatedAt);
    console.log("  emailClicked:", lead.emailClickedAt);
    console.log("  waClicked:", lead.whatsappClickedAt);
    console.log("  panelVisited:", lead.panelVisitedAt);
  } else {
    console.log("\nSin lead asociado");
  }

  const sessions7d = await p.session.count({ where: { restaurantId: rest.id, startedAt: { gte: new Date(Date.now() - 7 * 86400000) } } });
  console.log("\nSessions 7d:", sessions7d);

  // Determine scenario
  if (!lead?.activatedAt && !lead?.panelVisitedAt && !lead?.emailClickedAt && !lead?.whatsappClickedAt) {
    console.log("\n-> Escenario: carta_no_revisada");
  } else if (lead?.emailClickedAt || lead?.whatsappClickedAt) {
    console.log("\n-> Escenario: vio_no_activo");
  } else {
    console.log("\n-> Escenario: no_volvio");
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
