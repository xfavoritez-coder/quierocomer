import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OWNER_ACTIONS = new Set([
  "panel_login", "panel_visit",
  "dish_edit", "dish_create", "dish_delete", "dish_show", "dish_hide",
  "photo_upload",
  "category_edit", "category_create", "category_delete", "category_show", "category_hide",
  "promo_create", "promo_edit",
  "announcement_create",
  "settings_change",
]);

type LifecycleStage =
  | "LEAD_PROCESANDO" | "LEAD_FALLIDO" | "LEAD_NO_VIO" | "LEAD_VIO_NO_ACTIVO"
  | "ACTIVADO_SIN_USO" | "TRIAL_USANDO" | "TRIAL_ACTIVO" | "TRIAL_DORMIDO" | "TRIAL_VENCIDO"
  | "ACTIVO" | "BONIFICADO" | "DORMIDO" | "DEMO";

function isDormant(lastOwnerActivity: Date | null, lastLogin: Date | null, now: Date): boolean {
  const latest = [lastOwnerActivity, lastLogin].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];
  if (!latest) return true;
  return (now.getTime() - latest.getTime()) > 7 * 24 * 60 * 60 * 1000;
}

function computeLifecycleStage(input: any, now: Date): LifecycleStage {
  const { restaurant: r, lead, lastOwnerActivity, sessions7d } = input;
  if (!r) {
    if (!lead) return "DEMO";
    if (lead.cartaStatus === "FAILED") return "LEAD_FALLIDO";
    if (["PENDING", "PROCESSING", "READY"].includes(lead.cartaStatus)) return "LEAD_PROCESANDO";
    if (!lead.emailClickedAt && !lead.whatsappClickedAt) return "LEAD_NO_VIO";
    return "LEAD_VIO_NO_ACTIVO";
  }
  if (r.isDemo) {
    if (!lead) return "DEMO";
    if (lead.cartaStatus === "FAILED") return "LEAD_FALLIDO";
    if (["PENDING", "PROCESSING", "READY"].includes(lead.cartaStatus)) return "LEAD_PROCESANDO";
    if (!lead.emailClickedAt && !lead.whatsappClickedAt) return "LEAD_NO_VIO";
    return "LEAD_VIO_NO_ACTIVO";
  }
  if (r.billingExempt) return "BONIFICADO";
  if (r.subscriptionStatus === "ACTIVE") return "ACTIVO";
  if (r.subscriptionStatus === "TRIALING" && r.trialEndsAt) {
    if (r.trialEndsAt.getTime() > now.getTime()) {
      if (isDormant(lastOwnerActivity, r.ownerLastLoginAt, now)) return "TRIAL_DORMIDO";
      if (sessions7d >= 10) return "TRIAL_USANDO";
      return "TRIAL_ACTIVO";
    }
    return "TRIAL_VENCIDO";
  }
  if (r.trialEndsAt && r.trialEndsAt.getTime() < now.getTime() && r.subscriptionStatus === "NONE") return "TRIAL_VENCIDO";
  if (r.hasOwner && !r.ownerLastLoginAt && !lastOwnerActivity) return "ACTIVADO_SIN_USO";
  if (isDormant(lastOwnerActivity, r.ownerLastLoginAt, now)) return "DORMIDO";
  return "DORMIDO";
}

const NURTURING_MAP: Partial<Record<LifecycleStage, { action: string }>> = {
  LEAD_NO_VIO:        { action: "nurturing_carta_no_revisada" },
  LEAD_VIO_NO_ACTIVO: { action: "nurturing_vio_no_activo" },
  ACTIVADO_SIN_USO:   { action: "nurturing_no_volvio" },
  TRIAL_DORMIDO:      { action: "nurturing_no_volvio" },
  DORMIDO:            { action: "nurturing_no_volvio" },
};

const BLACKLIST = new Set(["+56976485972", "+56977940643"]);

async function main() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;

  const [restaurants, leads, allActivity, sessions7dGroups] = await Promise.all([
    prisma.restaurant.findMany({
      where: { ownerId: { not: null } },
      select: {
        id: true, name: true, slug: true, isDemo: true,
        plan: true, subscriptionStatus: true, trialEndsAt: true, billingExempt: true,
        createdAt: true,
        owner: { select: { name: true, whatsapp: true, lastLoginAt: true } },
      },
    }),
    prisma.lead.findMany({
      where: { generatedSlug: { not: null }, whatsapp: { not: null } },
      select: {
        id: true, generatedSlug: true, ownerName: true, localName: true,
        whatsapp: true, cartaStatus: true, activated: true,
        emailClickedAt: true, whatsappClickedAt: true,
      },
    }),
    prisma.panelActivity.findMany({
      select: { restaurantId: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.session.groupBy({
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

  const existingNurturing = await prisma.panelActivity.findMany({
    where: { action: { startsWith: "nurturing_" } },
    select: { restaurantId: true },
  });
  const alreadyNurtured = new Set(existingNurturing.map((e: any) => e.restaurantId));

  const targets: any[] = [];

  for (const r of restaurants) {
    if (!r.owner?.whatsapp) continue;
    if (BLACKLIST.has(r.owner.whatsapp)) continue;

    const lead = leadBySlug.get(r.slug);
    const activity = activityByRest.get(r.id) || [];
    const sessions7d = sessions7dMap.get(r.id) || 0;
    const lastOwnerAct = activity.find((a: any) => OWNER_ACTIONS.has(a.action));

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

    const ageMs = now.getTime() - r.createdAt.getTime();
    const tooNew24 = ageMs < 24 * 60 * 60 * 1000;
    const tooNew12 = ageMs < TWELVE_HOURS;
    const already = alreadyNurtured.has(r.id);

    targets.push({
      name: r.name, slug: r.slug, whatsapp: r.owner.whatsapp, owner: r.owner.name,
      stage, action: nurturing.action, alreadySent: already,
      tooNew24, tooNew12,
      ageHours: Math.round(ageMs / (60*60*1000)),
      willSend24: !already && !tooNew24,
      willSend12: !already && !tooNew12,
    });
  }

  // Los que se GANAN con 12h vs 24h
  const gained = targets.filter(t => t.willSend12 && !t.willSend24);

  console.log("\n=== CON 12h: LOCALES NUEVOS QUE SE SUMAN (vs 24h) ===\n");
  for (const t of gained) {
    console.log(`  🆕 ${t.name} (${t.slug}) | ${t.stage} → ${t.action} | ${t.owner} ${t.whatsapp} | ${t.ageHours}h de antigüedad`);
  }

  const willSend12 = targets.filter(t => t.willSend12);
  const willSend24 = targets.filter(t => t.willSend24);
  const stillTooNew = targets.filter(t => t.tooNew12 && !t.alreadySent);

  console.log("\n=== TOTAL ENVÍOS CON 12h ===\n");
  for (const t of willSend12) {
    const isNew = gained.includes(t) ? " 🆕" : "";
    console.log(`  ✅ ${t.name} (${t.slug}) | ${t.stage} → ${t.action} | ${t.owner} ${t.whatsapp}${isNew}`);
  }

  if (stillTooNew.length) {
    console.log("\n=== AÚN MUY NUEVOS (<12h) ===\n");
    for (const t of stillTooNew) console.log(`  🕐 ${t.name} (${t.slug}) | ${t.ageHours}h`);
  }

  console.log("\n--- Comparación ---");
  console.log(`Con 24h enviaría: ${willSend24.length}`);
  console.log(`Con 12h enviaría: ${willSend12.length} (+${gained.length} nuevos)`);
  console.log(`Aún muy nuevos (<12h): ${stillTooNew.length}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
