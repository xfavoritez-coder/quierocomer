import { PrismaClient } from "@prisma/client";
import { computeLifecycleStage, OWNER_ACTIONS } from "../src/lib/admin/lifecycle";

const p = new PrismaClient();

async function main() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [restaurants, leads, allActivity, sessions7dGroups] = await Promise.all([
    p.restaurant.findMany({
      select: {
        id: true, name: true, slug: true, isDemo: true,
        plan: true, subscriptionStatus: true, trialEndsAt: true, billingExempt: true,
        createdAt: true, ownerId: true,
        owner: { select: { name: true, whatsapp: true, lastLoginAt: true } },
      },
    }),
    p.lead.findMany({
      where: { generatedSlug: { not: null } },
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
    p.session.groupBy({ by: ["restaurantId"], where: { startedAt: { gte: sevenDaysAgo } }, _count: true }),
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

  // ALL restaurants with their stage + nurturing status
  console.log("=== TODOS LOS RESTAURANTS ===\n");
  console.log("Restaurant".padEnd(35) + "Stage".padEnd(22) + "WA Owner".padEnd(16) + "Nurturing Enviado".padEnd(20) + "Motivo no envío");
  console.log("-".repeat(120));

  for (const r of restaurants) {
    const lead = leadBySlug.get(r.slug);
    const activity = activityByRest.get(r.id) || [];
    const sessions7d = sessions7dMap.get(r.id) || 0;
    const lastOwnerAct = activity.find(a => OWNER_ACTIONS.has(a.action));

    const stage = computeLifecycleStage({
      restaurant: {
        isDemo: r.isDemo, plan: r.plan, subscriptionStatus: r.subscriptionStatus,
        trialEndsAt: r.trialEndsAt, billingExempt: r.billingExempt,
        ownerLastLoginAt: r.owner?.lastLoginAt || null, hasOwner: !!r.owner,
      },
      lead: lead ? {
        cartaStatus: lead.cartaStatus, emailClickedAt: lead.emailClickedAt,
        whatsappClickedAt: lead.whatsappClickedAt, activated: lead.activated,
      } : null,
      lastOwnerActivity: lastOwnerAct?.createdAt || null,
      sessions7d,
    }, now);

    const hasNurturing = activity.some(a => a.action.startsWith("nurturing_"));
    const whatsapp = r.owner?.whatsapp || lead?.whatsapp || null;
    const ageMs = now.getTime() - r.createdAt.getTime();
    const tooNew = ageMs < 24 * 60 * 60 * 1000;

    let motivo = "";
    if (hasNurturing) motivo = "YA ENVIADO";
    else if (!whatsapp) motivo = "SIN WHATSAPP";
    else if (tooNew) motivo = "< 24h (muy nuevo)";
    else if (!r.ownerId && !lead?.whatsapp) motivo = "SIN OWNER NI LEAD";
    else if (["TRIAL_USANDO", "TRIAL_ACTIVO", "ACTIVO", "BONIFICADO"].includes(stage)) motivo = "ACTIVO/USANDO";
    else if (stage === "LEAD_PROCESANDO") motivo = "AUN PROCESANDO";
    else if (stage === "LEAD_FALLIDO") motivo = "EXTRACCION FALLO";
    else motivo = ">>> PENDIENTE ENVIAR <<<";

    const flag = motivo === ">>> PENDIENTE ENVIAR <<<" ? "***" : "   ";
    console.log(`${flag} ${r.name.padEnd(32)} ${stage.padEnd(22)} ${(whatsapp || "-").padEnd(16)} ${(hasNurturing ? "SI" : "NO").padEnd(20)} ${motivo}`);
  }

  // Also check orphan leads
  const usedSlugs = new Set(restaurants.map(r => r.slug));
  console.log("\n=== LEADS SIN RESTAURANT ===\n");
  for (const lead of leads) {
    if (!lead.generatedSlug || usedSlugs.has(lead.generatedSlug)) continue;
    console.log(`${lead.localName?.padEnd(32) || "?"} | ${lead.cartaStatus.padEnd(12)} | WA: ${lead.whatsapp || "no"} | owner: ${lead.ownerName}`);
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
