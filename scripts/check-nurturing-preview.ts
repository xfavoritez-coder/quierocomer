import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const BLACKLIST = new Set(["+56976485972", "+56977940643"]);

async function main() {
  const simulated = new Date("2026-06-03T20:00:00.000Z");
  const oneDayAgo = new Date(simulated.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(simulated.getTime() - 7 * 24 * 60 * 60 * 1000);

  console.log(`Simulando cron del ${simulated.toISOString()} (3 junio 16:00 Chile)\n`);

  let willSend = 0;

  // Helper: check if nurturing already sent for restaurant via PanelActivity
  async function alreadySent(restaurantId: string, action: string) {
    const existing = await prisma.panelActivity.findFirst({
      where: { restaurantId, action },
      select: { id: true },
    });
    return !!existing;
  }

  // ═══ Scenario 1: carta_no_revisada ═══
  const s1Restaurants = await prisma.restaurant.findMany({
    where: { createdAt: { lt: oneDayAgo, gt: sevenDaysAgo }, ownerId: { not: null } },
    select: { id: true, name: true, slug: true, owner: { select: { name: true, whatsapp: true, lastLoginAt: true } } },
  });

  console.log("=== ESCENARIO 1: No reviso la carta ===");
  for (const r of s1Restaurants) {
    if (!r.owner?.whatsapp || BLACKLIST.has(r.owner.whatsapp)) continue;
    if (r.owner.lastLoginAt) continue;
    const lead = await prisma.lead.findFirst({ where: { generatedSlug: r.slug, cartaStatus: "DELIVERED" }, select: { id: true } });
    if (!lead) continue;
    const activity = await prisma.panelActivity.findFirst({ where: { restaurantId: r.id, action: { not: { startsWith: "nurturing_" } } }, select: { id: true } });
    if (activity) continue;
    const skip = await alreadySent(r.id, "nurturing_carta_no_revisada");
    if (!skip) willSend++;
    console.log(`  ${skip ? "[SKIP]" : "[ENVIAR]"} ${r.name} - ${r.owner.name} - ${r.owner.whatsapp}`);
  }

  // ═══ Scenario 2: vio_no_activo ═══
  const s2Leads = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED", generatedSlug: { not: null }, whatsapp: { not: null },
      OR: [{ emailClickedAt: { not: null } }, { whatsappClickedAt: { not: null } }],
    },
    select: { ownerName: true, whatsapp: true, generatedSlug: true },
  });

  console.log("\n=== ESCENARIO 2: Vio carta pero no activo ===");
  for (const lead of s2Leads) {
    if (!lead.whatsapp || !lead.generatedSlug || BLACKLIST.has(lead.whatsapp)) continue;
    const rest = await prisma.restaurant.findFirst({
      where: { slug: lead.generatedSlug, plan: "FREE", subscriptionStatus: "NONE" },
      select: { id: true, name: true, owner: { select: { whatsapp: true } } },
    });
    if (!rest) continue;
    const wa = rest.owner?.whatsapp || lead.whatsapp;
    if (BLACKLIST.has(wa)) continue;
    const skip = await alreadySent(rest.id, "nurturing_vio_no_activo");
    if (!skip) willSend++;
    console.log(`  ${skip ? "[SKIP]" : "[ENVIAR]"} ${rest.name} - ${lead.ownerName} - ${wa}`);
  }

  // ═══ Scenario 3: no_volvio (ALL restaurants with owner, dormidos) ═══
  const s3Restaurants = await prisma.restaurant.findMany({
    where: { ownerId: { not: null }, isDemo: false },
    select: { id: true, name: true, updatedAt: true, owner: { select: { name: true, whatsapp: true, lastLoginAt: true } } },
  });

  console.log("\n=== ESCENARIO 3: Dormidos (no volvieron) ===");
  for (const r of s3Restaurants) {
    if (!r.owner?.whatsapp || BLACKLIST.has(r.owner.whatsapp)) continue;
    if (r.owner.lastLoginAt && r.owner.lastLoginAt > sevenDaysAgo) continue;

    const recentActivity = await prisma.panelActivity.findFirst({
      where: { restaurantId: r.id, createdAt: { gt: sevenDaysAgo }, action: { not: { startsWith: "nurturing_" } } },
      select: { id: true },
    });
    if (recentActivity) continue;

    const recentEdits = await prisma.dish.count({ where: { restaurantId: r.id, updatedAt: { gt: sevenDaysAgo } } });
    if (recentEdits > 0) continue;

    const skip = await alreadySent(r.id, "nurturing_no_volvio");
    if (!skip) willSend++;
    console.log(`  ${skip ? "[SKIP]" : "[ENVIAR]"} ${r.name} - ${r.owner.name} - ${r.owner.whatsapp}`);
  }

  console.log(`\nTotal mensajes a enviar: ${willSend}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
