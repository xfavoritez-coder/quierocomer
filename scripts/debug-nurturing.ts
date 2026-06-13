import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  console.log("=== DEBUG SCENARIO 2: vio_no_activo ===");
  console.log("Condición: lead DELIVERED + clickeó email/WA + restaurant FREE + subscriptionStatus NONE\n");

  // First: how many leads clicked?
  const clickedLeads = await p.lead.findMany({
    where: {
      cartaStatus: "DELIVERED",
      generatedSlug: { not: null },
      whatsapp: { not: null },
      OR: [{ emailClickedAt: { not: null } }, { whatsappClickedAt: { not: null } }],
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true, emailClickedAt: true, whatsappClickedAt: true },
    take: 50,
  });
  console.log(`Leads que clickearon (DELIVERED + click): ${clickedLeads.length}`);

  for (const lead of clickedLeads) {
    if (!lead.generatedSlug) continue;
    const rest = await p.restaurant.findFirst({
      where: { slug: lead.generatedSlug },
      select: { id: true, name: true, plan: true, subscriptionStatus: true, isDemo: true },
    });
    const reason = !rest ? "NO RESTAURANT" 
      : rest.plan !== "FREE" ? `plan=${rest.plan}` 
      : rest.subscriptionStatus !== "NONE" ? `status=${rest.subscriptionStatus}`
      : "CALIFICA";
    const already = rest ? await p.panelActivity.findFirst({ where: { restaurantId: rest.id, action: "nurturing_vio_no_activo" }, select: { id: true } }) : null;
    console.log(`  ${lead.localName} | ${rest?.name || "?"} | ${reason} | ${already ? "YA ENVIADO" : "pendiente"}`);
  }

  console.log("\n\n=== DEBUG SCENARIO 3: no_volvio ===");
  console.log("Condición: owner + isDemo=false + sin login 7d + sin actividad 7d + sin edits 7d\n");

  const activeRests = await p.restaurant.findMany({
    where: { ownerId: { not: null }, isDemo: false },
    select: { 
      id: true, name: true, plan: true,
      owner: { select: { name: true, whatsapp: true, lastLoginAt: true } },
    },
    take: 100,
  });
  console.log(`Restaurants con owner + no demo: ${activeRests.length}\n`);

  for (const r of activeRests) {
    if (!r.owner?.whatsapp) continue;
    
    const loginRecent = r.owner.lastLoginAt && r.owner.lastLoginAt > sevenDaysAgo;
    const recentActivity = await p.panelActivity.findFirst({
      where: { restaurantId: r.id, createdAt: { gt: sevenDaysAgo }, action: { not: { startsWith: "nurturing_" } } },
      select: { id: true },
    });
    const recentEdits = await p.dish.count({ where: { restaurantId: r.id, updatedAt: { gt: sevenDaysAgo } } });
    const already = await p.panelActivity.findFirst({ where: { restaurantId: r.id, action: "nurturing_no_volvio" }, select: { id: true } });

    const reason = loginRecent ? "LOGIN RECIENTE"
      : recentActivity ? "ACTIVIDAD RECIENTE"
      : recentEdits > 0 ? `EDITS RECIENTES (${recentEdits})`
      : already ? "YA ENVIADO"
      : "CALIFICA";
    
    console.log(`  ${r.name} | ${r.plan} | login: ${r.owner.lastLoginAt?.toISOString().slice(0,10) || "nunca"} | ${reason}`);
  }

  // Also check: how many leads have seen their carta but NOT activated?
  console.log("\n\n=== LEADS QUE VIERON CARTA PERO NO ACTIVARON ===");
  const seenNotActivated = await p.lead.findMany({
    where: {
      cartaStatus: "DELIVERED",
      generatedSlug: { not: null },
      activated: false,
      OR: [
        { emailClickedAt: { not: null } },
        { whatsappClickedAt: { not: null } },
        { emailOpenedAt: { not: null } },
      ],
    },
    select: { localName: true, ownerName: true, whatsapp: true, generatedSlug: true, emailClickedAt: true, whatsappClickedAt: true, emailOpenedAt: true },
    take: 30,
  });
  console.log(`Total: ${seenNotActivated.length}`);
  for (const l of seenNotActivated) {
    const rest = await p.restaurant.findFirst({
      where: { slug: l.generatedSlug! },
      select: { plan: true, subscriptionStatus: true, isDemo: true },
    });
    console.log(`  ${l.localName} | ${l.ownerName} | WA: ${l.whatsapp || "no"} | demo: ${rest?.isDemo} | plan: ${rest?.plan} | status: ${rest?.subscriptionStatus} | clicked: ${l.emailClickedAt ? "email" : ""}${l.whatsappClickedAt ? " wa" : ""}${l.emailOpenedAt ? " opened" : ""}`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
