import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const BLACKLIST = new Set(["+56976485972", "+56977940643"]);

  console.log("=== SCENARIO 1: carta_no_revisada ===");
  console.log("(Creado hace 24h-7d, owner nunca logueó, sin actividad, lead DELIVERED)\n");

  const s1 = await p.restaurant.findMany({
    where: { createdAt: { lt: oneDayAgo, gt: sevenDaysAgo }, ownerId: { not: null } },
    select: { id: true, name: true, slug: true, owner: { select: { name: true, whatsapp: true, lastLoginAt: true } } },
    take: 50,
  });

  for (const r of s1) {
    if (!r.owner?.whatsapp || BLACKLIST.has(r.owner.whatsapp)) continue;
    if (r.owner.lastLoginAt) continue;
    const lead = await p.lead.findFirst({ where: { generatedSlug: r.slug, cartaStatus: "DELIVERED" }, select: { id: true } });
    if (!lead) continue;
    const activity = await p.panelActivity.findFirst({ where: { restaurantId: r.id, action: { not: { startsWith: "nurturing_" } } }, select: { id: true } });
    if (activity) continue;
    const already = await p.panelActivity.findFirst({ where: { restaurantId: r.id, action: "nurturing_carta_no_revisada" }, select: { id: true } });
    const firstName = (r.owner.name || "Hola").split(" ")[0];
    console.log(`  ${already ? "[YA ENVIADO]" : "[ENVIARÁ]"} ${r.name} → ${r.owner.whatsapp} (${firstName})`);
    console.log(`    Msg: Hola ${firstName}, tu carta de ${r.name} esta lista y esperandote. ¿Quieres verla? — Camila de QuieroComer\n`);
  }

  console.log("\n=== SCENARIO 2: vio_no_activo ===");
  console.log("(Lead clickeó email/WA, pero plan FREE sin trial)\n");

  const s2 = await p.lead.findMany({
    where: {
      cartaStatus: "DELIVERED", generatedSlug: { not: null }, whatsapp: { not: null },
      OR: [{ emailClickedAt: { not: null } }, { whatsappClickedAt: { not: null } }],
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true },
    take: 50,
  });

  for (const lead of s2) {
    if (!lead.whatsapp || !lead.generatedSlug) continue;
    if (BLACKLIST.has(lead.whatsapp)) continue;
    const rest = await p.restaurant.findFirst({
      where: { slug: lead.generatedSlug, plan: "FREE", subscriptionStatus: "NONE" },
      select: { id: true, name: true, owner: { select: { name: true, whatsapp: true } } },
    });
    if (!rest) continue;
    const whatsapp = rest.owner?.whatsapp || lead.whatsapp;
    const ownerName = rest.owner?.name || lead.ownerName || "Hola";
    const firstName = ownerName.split(" ")[0];
    const already = await p.panelActivity.findFirst({ where: { restaurantId: rest.id, action: "nurturing_vio_no_activo" }, select: { id: true } });
    console.log(`  ${already ? "[YA ENVIADO]" : "[ENVIARÁ]"} ${rest.name} → ${whatsapp} (${firstName})`);
    console.log(`    Msg: Hola ${firstName}, vi que revisaste la carta de ${rest.name}. ¿Necesitas ayuda para activar tu local? — Camila de QuieroComer\n`);
  }

  console.log("\n=== SCENARIO 3: no_volvio ===");
  console.log("(Activó pero dormido 7+ dias sin actividad)\n");

  const s3 = await p.restaurant.findMany({
    where: { ownerId: { not: null }, isDemo: false },
    select: { id: true, name: true, owner: { select: { name: true, whatsapp: true, lastLoginAt: true } } },
    take: 100,
  });

  for (const r of s3) {
    if (!r.owner?.whatsapp || BLACKLIST.has(r.owner.whatsapp)) continue;
    if (r.owner.lastLoginAt && r.owner.lastLoginAt > sevenDaysAgo) continue;
    const recentActivity = await p.panelActivity.findFirst({
      where: { restaurantId: r.id, createdAt: { gt: sevenDaysAgo }, action: { not: { startsWith: "nurturing_" } } },
      select: { id: true },
    });
    if (recentActivity) continue;
    const recentEdits = await p.dish.count({ where: { restaurantId: r.id, updatedAt: { gt: sevenDaysAgo } } });
    if (recentEdits > 0) continue;
    const already = await p.panelActivity.findFirst({ where: { restaurantId: r.id, action: "nurturing_no_volvio" }, select: { id: true } });
    const firstName = (r.owner.name || "Hola").split(" ")[0];
    console.log(`  ${already ? "[YA ENVIADO]" : "[ENVIARÁ]"} ${r.name} → ${r.owner.whatsapp} (${firstName})`);
    console.log(`    Msg: Hola ${firstName}, hace unos dias activaste ${r.name} pero no has vuelto. ¿Todo bien? — Camila de QuieroComer\n`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
