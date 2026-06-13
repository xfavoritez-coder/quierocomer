import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const results = await prisma.restaurant.findMany({
    where: { name: { contains: "attara", mode: "insensitive" } },
    select: { id: true, name: true, slug: true, isDemo: true, plan: true, subscriptionStatus: true, trialEndsAt: true, billingExempt: true, createdAt: true, ownerId: true, owner: { select: { name: true, whatsapp: true, lastLoginAt: true } } },
  });
  for (const r of results) {
    console.log("=== RESTAURANT ===");
    console.log(JSON.stringify(r, null, 2));
    const lead = await prisma.lead.findFirst({ where: { generatedSlug: r.slug }, select: { id: true, cartaStatus: true, activated: true, emailClickedAt: true, whatsappClickedAt: true, whatsapp: true } });
    console.log("Lead:", JSON.stringify(lead, null, 2));
    const nurt = await prisma.panelActivity.findFirst({ where: { restaurantId: r.id, action: { startsWith: "nurturing_" } }, select: { action: true, createdAt: true } });
    console.log("Nurturing previo:", JSON.stringify(nurt, null, 2));
    const ageH = Math.round((Date.now() - new Date(r.createdAt).getTime()) / 3600000);
    console.log("Edad:", ageH, "horas");
  }
  if (results.length === 0) {
    console.log("No se encontro. Buscando en leads...");
    const leads = await prisma.lead.findMany({ where: { localName: { contains: "attara", mode: "insensitive" } }, select: { id: true, localName: true, generatedSlug: true, whatsapp: true, cartaStatus: true, activated: true } });
    console.log(JSON.stringify(leads, null, 2));
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
