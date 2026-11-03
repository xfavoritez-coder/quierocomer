import { config } from "dotenv";
config({ path: ".env.prod" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const lead = await prisma.lead.findFirst({
    where: { localName: { contains: "umami", mode: "insensitive" } },
    select: {
      id: true, email: true, ownerName: true, localName: true,
      cartaStatus: true, deliveredAt: true, activated: true,
      emailClickedAt: true, events: true, generatedSlug: true,
    },
  });

  if (!lead) { console.log("No encontrado"); return; }

  console.log("Lead:", JSON.stringify(lead, null, 2));

  const now = new Date();
  const nudgeWindowStart = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const nudgeWindowEnd   = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  console.log("\n--- Diagnóstico ---");
  console.log("cartaStatus === DELIVERED:", lead.cartaStatus === "DELIVERED");
  console.log("deliveredAt:", lead.deliveredAt);
  console.log("ventana esperada:", nudgeWindowStart.toISOString(), "→", nudgeWindowEnd.toISOString());
  if (lead.deliveredAt) {
    const inWindow = lead.deliveredAt >= nudgeWindowStart && lead.deliveredAt <= nudgeWindowEnd;
    console.log("deliveredAt en ventana (3-5 días atrás):", inWindow);
    const daysAgo = (now.getTime() - lead.deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
    console.log("Hace cuántos días fue entregada:", daysAgo.toFixed(1));
  }
  const events = Array.isArray(lead.events) ? lead.events : [];
  console.log("ya tiene qr_nudge_sent:", events.some((e: any) => e.type === "qr_nudge_sent"));
  console.log("tiene email:", !!lead.email && lead.email !== "");

  await prisma.$disconnect();
}
main().catch(console.error);
