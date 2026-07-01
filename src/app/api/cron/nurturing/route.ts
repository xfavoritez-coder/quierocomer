import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";
import { computeLifecycleStage, OWNER_ACTIONS, type LifecycleStage } from "@/lib/admin/lifecycle";

export const maxDuration = 60;

const TEMPLATES = {
  cartaNoRevisada: "HX212aca9223fecaf089df099969e19a25",
  noVolvio: "HXe8201d69e53b2c6c4c2af79470c34845",
};

// Stages that get nurturing + which template/action to use
const NURTURING_MAP: Partial<Record<LifecycleStage, { action: string; template: string }>> = {
  LEAD_NO_VIO:        { action: "nurturing_carta_no_revisada", template: TEMPLATES.cartaNoRevisada },
  LEAD_VIO_NO_ACTIVO: { action: "nurturing_vio_no_activo",    template: TEMPLATES.noVolvio },
  ACTIVADO_SIN_USO:   { action: "nurturing_no_volvio",        template: TEMPLATES.noVolvio },
  TRIAL_DORMIDO:      { action: "nurturing_no_volvio",        template: TEMPLATES.noVolvio },
  DORMIDO:            { action: "nurturing_no_volvio",        template: TEMPLATES.noVolvio },
};

// Exact template texts as approved by Meta (with variables replaced)
const TEMPLATE_TEXTS: Record<string, (name: string, rest: string) => string> = {
  nurturing_carta_no_revisada: (n, r) => `Hola ${n}, soy Camila de QuieroComer 👋 Te escribo por la carta de ${r}, ya está lista pero vi que aún no la revisas. ¿Tienes alguna duda o algo en que te pueda ayudar?`,
  nurturing_vio_no_activo: (n, r) => `Hola ${n}, soy Camila de QuieroComer 👋 Te escribo por la carta de ${r}, vi que la activaste y está lista pero no la continuaste usando. ¿Habrá algo que no te gustó o tienes alguna duda? Cualquier cosa es bienvenida, nos encantaría saber.`,
  nurturing_no_volvio: (n, r) => `Hola ${n}, soy Camila de QuieroComer 👋 Te escribo por la carta de ${r}, vi que la activaste y está lista pero no la continuaste usando. ¿Habrá algo que no te gustó o tienes alguna duda? Cualquier cosa es bienvenida, nos encantaría saber.`,
};

const BLACKLIST = new Set(["+56976485972", "+56977940643", "+56971204150", "+56999946208"]); // Il Mascalzone, Cuartel 50, Taranta Chicureo, Test Pago

/**
 * Cron: Lead nurturing via WhatsApp — runs daily at 16:00 Chile (20:00 UTC).
 * Uses lifecycle stages to determine who gets which template.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const queryKey = req.nextUrl.searchParams.get("key");
  const seedSecret = process.env.SEED_SECRET;
  const isAuthorized =
    !process.env.CRON_SECRET ||
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    (seedSecret && queryKey === seedSecret);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Test mode ──
  const rawTestPhone = req.nextUrl.searchParams.get("test");
  const testPhone = rawTestPhone?.trim().replace(/^\s/, "+") || null;
  if (testPhone) {
    const scenarioMap: Record<string, string> = {
      carta_no_revisada: TEMPLATES.cartaNoRevisada,
      vio_no_activo: TEMPLATES.noVolvio,
      no_volvio: TEMPLATES.noVolvio,
    };
    const scenarioKey = req.nextUrl.searchParams.get("scenario") || "carta_no_revisada";
    const templateSid = scenarioMap[scenarioKey];
    if (!templateSid) return NextResponse.json({ error: `Scenario invalido: ${scenarioKey}`, valid: Object.keys(scenarioMap) }, { status: 400 });
    try {
      const msgSid = await sendWhatsApp({ to: testPhone, body: "", contentSid: templateSid, contentVariables: { "1": "Test", "2": "Restaurante Demo" } });
      return NextResponse.json({ test: true, phone: testPhone, scenario: scenarioKey, sid: msgSid });
    } catch (e: any) {
      return NextResponse.json({ test: true, phone: testPhone, scenario: scenarioKey, error: e.message }, { status: 500 });
    }
  }

  const start = Date.now();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const stageCounts: Record<string, number> = {};

  // ── Fetch all data in parallel ──
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
        emailClickedAt: true, whatsappClickedAt: true, events: true,
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

  // Build maps
  const leadBySlug = new Map<string, typeof leads[0]>();
  for (const l of leads) { if (l.generatedSlug) leadBySlug.set(l.generatedSlug, l); }

  const activityByRest = new Map<string, typeof allActivity>();
  for (const a of allActivity) {
    if (!activityByRest.has(a.restaurantId)) activityByRest.set(a.restaurantId, []);
    activityByRest.get(a.restaurantId)!.push(a);
  }

  const sessions7dMap = new Map<string, number>();
  for (const s of sessions7dGroups) sessions7dMap.set(s.restaurantId, s._count);

  // ── Process each restaurant ──
  for (const r of restaurants) {
    if (!r.owner?.whatsapp) continue;
    if (BLACKLIST.has(r.owner.whatsapp)) continue;

    const lead = leadBySlug.get(r.slug);
    const activity = activityByRest.get(r.id) || [];
    const sessions7d = sessions7dMap.get(r.id) || 0;

    // Find last owner-initiated activity
    const lastOwnerAct = activity.find(a => OWNER_ACTIONS.has(a.action));

    const stage = computeLifecycleStage({
      restaurant: {
        isDemo: r.isDemo,
        plan: r.plan,
        subscriptionStatus: r.subscriptionStatus,
        trialEndsAt: r.trialEndsAt,
        billingExempt: r.billingExempt,
        ownerLastLoginAt: r.owner.lastLoginAt,
        hasOwner: true,
      },
      lead: lead ? {
        cartaStatus: lead.cartaStatus,
        emailClickedAt: lead.emailClickedAt,
        whatsappClickedAt: lead.whatsappClickedAt,
        activated: lead.activated,
      } : null,
      lastOwnerActivity: lastOwnerAct?.createdAt || null,
      sessions7d,
    }, now);

    stageCounts[stage] = (stageCounts[stage] || 0) + 1;

    // Check if this stage gets nurturing
    const nurturing = NURTURING_MAP[stage];
    if (!nurturing) continue;

    // Skip if already sent ANY nurturing to this restaurant (via PanelActivity OR Lead.events)
    const already = await prisma.panelActivity.findFirst({
      where: { restaurantId: r.id, action: { startsWith: "nurturing_" } },
      select: { id: true },
    });
    if (already) { skipped++; continue; }

    // Also check Lead.events (written by the one-time-nurturing endpoint)
    if (lead) {
      const events = Array.isArray(lead.events) ? (lead.events as any[]) : [];
      const alreadyInEvents = events.some((e: any) => typeof e.action === "string" && e.action.startsWith("nurturing_"));
      if (alreadyInEvents) { skipped++; continue; }
    }

    // Only send to restaurants created more than 24h ago (give them time)
    const ageMs = now.getTime() - r.createdAt.getTime();
    if (ageMs < 8 * 60 * 60 * 1000) { skipped++; continue; }

    const whatsapp = r.owner.whatsapp;
    const ownerName = r.owner.name || lead?.ownerName || "Hola";
    const firstName = ownerName.split(" ")[0];

    try {
      const sid = await sendWhatsApp({
        to: whatsapp,
        body: "",
        contentSid: nurturing.template,
        contentVariables: { "1": firstName, "2": r.name },
      });

      if (sid) {
        await prisma.panelActivity.create({
          data: {
            restaurantId: r.id,
            action: nurturing.action,
            details: { sid, whatsapp, ownerName: firstName, restaurantName: r.name, stage },
          },
        });
        const msgBody = TEMPLATE_TEXTS[nurturing.action]?.(firstName, r.name) || `Nurturing: ${nurturing.action}`;
        const leadRecord = lead || await prisma.lead.findFirst({ where: { whatsapp: { contains: whatsapp.replace("+", "") } }, select: { id: true } }).catch(() => null);
        await prisma.whatsAppMessage.create({
          data: {
            phone: whatsapp, direction: "OUTBOUND", body: msgBody,
            twilioSid: sid, status: "sent", restaurantId: r.id,
            leadId: (leadRecord as any)?.id || null,
          },
        }).catch(() => {});
        sent++;
        console.log(`[nurturing] ${stage} → ${nurturing.action}: ${whatsapp} (${r.name})`);
      } else {
        errors++;
      }
    } catch (e: any) {
      console.error(`[nurturing] ${nurturing.action} error for ${whatsapp}:`, e.message);
      errors++;
    }
  }

  // ── Also check orphan leads (no restaurant) for LEAD_NO_VIO ──
  const usedSlugs = new Set(restaurants.map(r => r.slug));
  for (const lead of leads) {
    if (!lead.generatedSlug || usedSlugs.has(lead.generatedSlug)) continue;
    if (!lead.whatsapp || BLACKLIST.has(lead.whatsapp)) continue;

    const stage = computeLifecycleStage({
      restaurant: null,
      lead: { cartaStatus: lead.cartaStatus, emailClickedAt: lead.emailClickedAt, whatsappClickedAt: lead.whatsappClickedAt, activated: lead.activated },
      lastOwnerActivity: null,
      sessions7d: 0,
    }, now);

    const nurturing = NURTURING_MAP[stage];
    if (!nurturing) continue;
    // Can't track without restaurantId, skip orphans for now
  }

  const durationMs = Date.now() - start;

  await prisma.cronLog.create({
    data: {
      jobName: "nurturing",
      status: errors > 0 && sent === 0 ? "error" : "success",
      durationMs,
      details: { sent, skipped, errors, stageCounts },
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, sent, skipped, errors, stageCounts, durationMs });
}
