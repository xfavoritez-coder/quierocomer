import { PrismaClient } from "@prisma/client";
import { computeLifecycleStage, OWNER_ACTIONS } from "../src/lib/admin/lifecycle";
const p = new PrismaClient();

async function main() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [restaurants, leads, allActivity, sessions7dGroups] = await Promise.all([
    p.restaurant.findMany({
      select: { id: true, name: true, slug: true, isDemo: true, plan: true, subscriptionStatus: true, trialEndsAt: true, billingExempt: true, createdAt: true, ownerId: true, owner: { select: { whatsapp: true, lastLoginAt: true } } },
    }),
    p.lead.findMany({ where: { generatedSlug: { not: null } }, select: { generatedSlug: true, whatsapp: true, cartaStatus: true, activated: true, emailClickedAt: true, whatsappClickedAt: true } }),
    p.panelActivity.findMany({ select: { restaurantId: true, action: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    p.session.groupBy({ by: ["restaurantId"], where: { startedAt: { gte: sevenDaysAgo } }, _count: true }),
  ]);

  const leadBySlug = new Map(); for (const l of leads) { if (l.generatedSlug) leadBySlug.set(l.generatedSlug, l); }
  const activityByRest = new Map(); for (const a of allActivity) { if (!activityByRest.has(a.restaurantId)) activityByRest.set(a.restaurantId, []); activityByRest.get(a.restaurantId).push(a); }
  const sessions7dMap = new Map(); for (const s of sessions7dGroups) sessions7dMap.set(s.restaurantId, s._count);
  const nurtured = new Set(allActivity.filter(a => a.action.startsWith("nurturing_")).map(a => a.restaurantId));

  const BLACKLIST = new Set(["+56976485972", "+56977940643"]); // Il Mascalzone, Cuartel 50

  console.log("Restaurants SIN nurturing, CON WhatsApp, que NO están usando el servicio:\n");

  for (const r of restaurants) {
    if (nurtured.has(r.id)) continue;
    const wa = r.owner?.whatsapp || leadBySlug.get(r.slug)?.whatsapp || null;
    if (!wa || wa.length < 10 || BLACKLIST.has(wa)) continue;

    const lead = leadBySlug.get(r.slug);
    const activity = activityByRest.get(r.id) || [];
    const sessions7d = sessions7dMap.get(r.id) || 0;
    const lastOwnerAct = activity.find((a: any) => OWNER_ACTIONS.has(a.action));

    const stage = computeLifecycleStage({
      restaurant: { isDemo: r.isDemo, plan: r.plan, subscriptionStatus: r.subscriptionStatus, trialEndsAt: r.trialEndsAt, billingExempt: r.billingExempt, ownerLastLoginAt: r.owner?.lastLoginAt || null, hasOwner: !!r.ownerId },
      lead: lead ? { cartaStatus: lead.cartaStatus, emailClickedAt: lead.emailClickedAt, whatsappClickedAt: lead.whatsappClickedAt, activated: lead.activated } : null,
      lastOwnerActivity: lastOwnerAct?.createdAt || null,
      sessions7d,
    }, now);

    // Skip active ones
    if (["TRIAL_USANDO", "TRIAL_ACTIVO", "ACTIVO", "BONIFICADO"].includes(stage)) continue;

    const age = Math.floor((now.getTime() - r.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    console.log(`  ${r.name.padEnd(35)} | ${stage.padEnd(22)} | ${wa.padEnd(16)} | ${age}d`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
