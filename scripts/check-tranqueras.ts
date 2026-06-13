import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
async function main() {
  const p = new PrismaClient();
  const lead = await p.lead.findFirst({ where: { localName: { contains: "tranquera", mode: "insensitive" } }, orderBy: { createdAt: "desc" } });
  if (!lead) { console.log("Not found"); await p.$disconnect(); return; }
  console.log("Status:", lead.cartaStatus);
  console.log("Slug:", lead.generatedSlug);
  console.log("deliveredAt:", lead.deliveredAt);
  console.log("emailOpenedAt:", lead.emailOpenedAt);
  console.log("emailClickedAt:", lead.emailClickedAt);
  console.log("whatsappSentAt:", lead.whatsappSentAt);
  console.log("whatsappClickedAt:", lead.whatsappClickedAt);
  console.log("onboardingDoneAt:", lead.onboardingDoneAt);
  console.log("panelVisitedAt:", lead.panelVisitedAt);
  console.log("activarVisitedAt:", lead.activarVisitedAt);
  console.log("activatedAt:", lead.activatedAt);
  await p.$disconnect();
}
main();
