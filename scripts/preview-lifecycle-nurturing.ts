import { PrismaClient } from "@prisma/client";
import { computeLifecycleStage, OWNER_ACTIONS } from "../src/lib/admin/lifecycle";

const p = new PrismaClient();
const BLACKLIST = new Set(["+56976485972", "+56977940643"]);

async function main() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const NURTURING_MAP: Record<string, { action: string; template: string }> = {
    LEAD_NO_VIO:        { action: "nurturing_carta_no_revisada", template: "camila_carta_no_revisada" },
    LEAD_VIO_NO_ACTIVO: { action: "nurturing_vio_no_activo",    template: "camila_no_volvio" },
    ACTIVADO_SIN_USO:   { action: "nurturing_no_volvio",        template: "camila_no_volvio" },
    TRIAL_DORMIDO:      { action: "nurturing_no_volvio",        template: "camila_no_volvio" },
    DORMIDO:            { action: "nurturing_no_volvio",        template: "camila_no_volvio" },
  };

  const [restaurants, leads, allActivity, sessions7dGroups] = await Promise.all([
    p.restaurant.findMany({
      where: { ownerId: { not: null } },
      select: {
        id: true, name: true, slug: true, isDemo: true,
        plan: true, subscriptionStatus: true, trialEndsAt: true, billingExempt: true,
        createdAt: true,
        owner: { select: { name: true, whatsapp: true, lastLoginAt: true } },
      },
    }),
    p.lead.findMany({
      where: { generatedSlug: { not: null }, whatsapp: { not: null } },
      select: {
        id: true, generatedSlug: true, ownerName: true, localName: true,
        whatsapp: true, cartaStatus: true, activated: true,
        emailClickedAt: true, whatsappClickedAt: true,
      },
    }),
    p.panelActivity.findMany({
      select: { restaurantId: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    p.session.groupBy({
      by: ["restaurantId"],
      where: { startedAt: { gte: sevenDaysAgo } },
      _count: true,
    }),
  ]);

  const leadBySlug = new Map<string, typeof leads[0]>();
  for (const l of leads) { if (l.generatedSlug) leadBySlug.set(l.generatedSlug, l); }

  const activityByRest = new Map<string, typeof allActivity>();
  for (const a of allActivity) {
    if (!activityByRest.has(a.restaurantId)) activityByRest.set(a.restaurantId, []);
    activityByRest.get(a.restaurantId)!.push(a);
  }

  const sessions7dMap = new Map<string, number>();
  for (const s of sessions7dGroups) sessions7dMap.set(s.restaurantId, s._count);

  // Candidates: eligible for nurturing but NOT already sent AND NOT in today's cron batch
  const candidates: { name: string; slug: string; stage: string; action: string; template: string; whatsapp: string; ownerName: string; createdAt: Date }[] = [];

  for (const r of restaurants) {
    if (!r.owner?.whatsapp || BLACKLIST.has(r.owner.whatsapp)) continue;

    const lead = leadBySlug.get(r.slug);
    const activity = activityByRest.get(r.id) || [];
    const sessions7d = sessions7dMap.get(r.id) || 0;
    const lastOwnerAct = activity.find(a => OWNER_ACTIONS.has(a.action));

    const stage = computeLifecycleStage({
      restaurant: {
        isDemo: r.isDemo, plan: r.plan, subscriptionStatus: r.subscriptionStatus,
        trialEndsAt: r.trialEndsAt, billingExempt: r.billingExempt,
        ownerLastLoginAt: r.owner.lastLoginAt, hasOwner: true,
      },
      lead: lead ? {
        cartaStatus: lead.cartaStatus, emailClickedAt: lead.emailClickedAt,
        whatsappClickedAt: lead.whatsappClickedAt, activated: lead.activated,
      } : null,
      lastOwnerActivity: lastOwnerAct?.createdAt || null,
      sessions7d,
    }, now);

    const nurturing = NURTURING_MAP[stage];
    if (!nurturing) continue;

    // Skip if < 24h old
    if (now.getTime() - r.createdAt.getTime() < 24 * 60 * 60 * 1000) continue;

    // Check if ALREADY sent ANY nurturing
    const already = await p.panelActivity.findFirst({
      where: { restaurantId: r.id, action: { startsWith: "nurturing_" } },
      select: { id: true },
    });
    if (already) continue;

    // This is the cron batch (created 1-7 days ago for scenario 1)
    // We want ones that are OLDER or different scenarios
    candidates.push({
      name: r.name,
      slug: r.slug,
      stage,
      action: nurturing.action,
      template: nurturing.template,
      whatsapp: r.owner.whatsapp,
      ownerName: r.owner.name || lead?.ownerName || "?",
      createdAt: r.createdAt,
    });
  }

  // Sort by oldest first
  candidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  console.log(`\nTotal candidatos elegibles: ${candidates.length}\n`);
  console.log("Los 20 más antiguos:\n");

  for (const c of candidates.slice(0, 30)) {
    const age = Math.floor((now.getTime() - c.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    const firstName = c.ownerName.split(" ")[0];
    console.log(`  ${c.name.padEnd(30)} | ${c.stage.padEnd(20)} | ${c.action.padEnd(30)} | ${c.whatsapp} | ${firstName.padEnd(12)} | ${age}d`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
