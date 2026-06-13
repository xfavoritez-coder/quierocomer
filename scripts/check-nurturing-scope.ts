import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

async function main() {
  // 1. Count fake nurturing events in leads
  const leadsWithNurturing = await p.lead.findMany({
    where: { events: { isEmpty: false } },
    select: { id: true, localName: true, whatsapp: true, events: true },
  });
  let fakeEvents = 0;
  for (const l of leadsWithNurturing) {
    const evts = Array.isArray(l.events) ? l.events as any[] : [];
    const nurt = evts.filter((e: any) => String(e.action).startsWith("nurturing"));
    if (nurt.length > 0) fakeEvents += nurt.length;
  }
  console.log(`\n=== EVENTOS NURTURING EN LEADS: ${fakeEvents} ===`);

  // 2. Restaurants with owners + WA that have NO lead
  const allRestaurants = await p.restaurant.findMany({
    where: { isDemo: false, owner: { isNot: null } },
    select: {
      id: true, name: true, slug: true, plan: true, subscriptionStatus: true,
      createdAt: true, updatedAt: true,
      owner: { select: { name: true, email: true, whatsapp: true, lastLoginAt: true } },
      _count: { select: { sessions: true } },
    },
  });

  const allLeadSlugs = new Set(
    (await p.lead.findMany({ where: { generatedSlug: { not: null } }, select: { generatedSlug: true } }))
      .map(l => l.generatedSlug!)
  );

  const withoutLead = allRestaurants.filter(r => !allLeadSlugs.has(r.slug));
  const withoutLeadAndWa = withoutLead.filter(r => r.owner?.whatsapp);

  console.log(`\n=== RESTAURANTS SIN LEAD ===`);
  console.log(`Total restaurants con owner: ${allRestaurants.length}`);
  console.log(`Sin lead asociado: ${withoutLead.length}`);
  console.log(`Sin lead + con WhatsApp (contactables): ${withoutLeadAndWa.length}`);
  console.log("\nEjemplos:");
  for (const r of withoutLeadAndWa.slice(0, 15)) {
    const now = Date.now();
    const daysSinceUpdate = Math.floor((now - r.updatedAt.getTime()) / 86400000);
    const lastLogin = r.owner?.lastLoginAt ? Math.floor((now - r.owner.lastLoginAt.getTime()) / 86400000) + "d" : "nunca";
    console.log(`  ${r.name} | ${r.owner?.name} | ${r.owner?.whatsapp} | plan=${r.plan} | sessions=${r._count.sessions} | lastUpdate=${daysSinceUpdate}d | lastLogin=${lastLogin}`);
  }

  // 3. ALL dormidos (salud=red): no activity in 7+ days, with owner+WA
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const recentActivity = await p.panelActivity.groupBy({
    by: ["restaurantId"],
    where: { createdAt: { gte: sevenDaysAgo } },
  });
  const activeIds = new Set(recentActivity.map(a => a.restaurantId));

  const dormidos = allRestaurants.filter(r => {
    if (!r.owner?.whatsapp) return false;
    if (activeIds.has(r.id)) return false;
    const lastLogin = r.owner?.lastLoginAt;
    if (lastLogin && lastLogin > sevenDaysAgo) return false;
    return true;
  });

  console.log(`\n=== DORMIDOS CON WHATSAPP (candidatos a Camila) ===`);
  console.log(`Total: ${dormidos.length}`);
  for (const r of dormidos) {
    const hasLead = allLeadSlugs.has(r.slug);
    const lastLogin = r.owner?.lastLoginAt ? Math.floor((Date.now() - r.owner.lastLoginAt.getTime()) / 86400000) + "d" : "nunca";
    console.log(`  ${hasLead ? "[LEAD]" : "[SIN LEAD]"} ${r.name} | ${r.owner?.name} | ${r.owner?.whatsapp} | plan=${r.plan} | sessions=${r._count.sessions} | lastLogin=${lastLogin}`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
