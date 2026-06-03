import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export const maxDuration = 60;

const TEMPLATES = {
  cartaNoRevisada: "HX212aca9223fecaf089df099969e19a25",
  noVolvio: "HXe8201d69e53b2c6c4c2af79470c34845",
};

// Números excluidos del nurturing
const BLACKLIST = new Set(["+56976485972", "+56977940643"]); // Il Mascalzone, Cuartel 50

/**
 * Cron: Lead nurturing via WhatsApp — runs daily at 16:00 Chile (20:00 UTC).
 *
 * 3 scenarios, all sent as "Camila de QuieroComer":
 *
 * 1. "carta_no_revisada": Restaurant creado hace 24h-7d, owner nunca hizo login,
 *    sin actividad en panel, tiene lead con cartaStatus=DELIVERED.
 * 2. "vio_no_activo": Tiene lead con emailClickedAt o whatsappClickedAt,
 *    pero no activó (plan FREE, no trial).
 * 3. "no_volvio": Restaurant con owner, plan activo o trial, pero dormido
 *    (sin actividad en panel en 7+ días, sin login reciente). Incluye restaurants sin lead.
 *
 * Tracking via PanelActivity (action = "nurturing_*"), one per restaurant+scenario.
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

  // ── Test mode: ?test=+56999946208&scenario=carta_no_revisada ──
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
      const msgSid = await sendWhatsApp({
        to: testPhone,
        body: "",
        contentSid: templateSid,
        contentVariables: { "1": "Test", "2": "Restaurante Demo" },
      });
      return NextResponse.json({ test: true, phone: testPhone, scenario: scenarioKey, sid: msgSid });
    } catch (e: any) {
      return NextResponse.json({ test: true, phone: testPhone, scenario: scenarioKey, error: e.message }, { status: 500 });
    }
  }

  const start = Date.now();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const candidates = { cartaNoRevisada: 0, vioNoActivo: 0, noVolvio: 0 };

  /**
   * Send a nurturing WhatsApp and track via PanelActivity.
   * Returns true if sent, false if skipped/error.
   */
  async function sendNurturing(opts: {
    restaurantId: string;
    restaurantName: string;
    ownerName: string;
    whatsapp: string;
    action: string;
    templateSid: string;
  }) {
    const { restaurantId, restaurantName, ownerName, whatsapp, action, templateSid } = opts;

    if (BLACKLIST.has(whatsapp)) { skipped++; return; }

    // Check if already sent for this restaurant
    const already = await prisma.panelActivity.findFirst({
      where: { restaurantId, action },
      select: { id: true },
    });
    if (already) { skipped++; return; }

    const firstName = (ownerName || "Hola").split(" ")[0];

    try {
      const sid = await sendWhatsApp({
        to: whatsapp,
        body: "",
        contentSid: templateSid,
        contentVariables: { "1": firstName, "2": restaurantName },
      });

      if (sid) {
        // Track in PanelActivity (prevents re-send)
        await prisma.panelActivity.create({
          data: {
            restaurantId,
            action,
            details: { sid, whatsapp, ownerName: firstName, restaurantName },
          },
        });
        // Also log in WhatsAppMessage so it shows in /admin/whatsapp
        const actionLabels: Record<string, string> = {
          nurturing_carta_no_revisada: `Hola ${firstName}, tu carta de ${restaurantName} esta lista y esperandote. ¿Quieres verla? — Camila de QuieroComer`,
          nurturing_vio_no_activo: `Hola ${firstName}, vi que revisaste la carta de ${restaurantName}. ¿Necesitas ayuda para activar tu local? — Camila de QuieroComer`,
          nurturing_no_volvio: `Hola ${firstName}, hace unos dias activaste ${restaurantName} pero no has vuelto. ¿Todo bien? Estoy para ayudarte — Camila de QuieroComer`,
        };
        const lead = await prisma.lead.findFirst({ where: { whatsapp: { contains: whatsapp.replace("+", "") } }, select: { id: true } }).catch(() => null);
        await prisma.whatsAppMessage.create({
          data: {
            phone: whatsapp,
            direction: "OUTBOUND",
            body: actionLabels[action] || `Nurturing: ${action}`,
            twilioSid: sid,
            status: "sent",
            restaurantId,
            leadId: lead?.id || null,
          },
        }).catch(() => {});
        sent++;
        console.log(`[nurturing] ${action}: ${whatsapp} (${restaurantName})`);
      } else {
        errors++;
      }
    } catch (e: any) {
      console.error(`[nurturing] ${action} error for ${whatsapp}:`, e.message);
      errors++;
    }
  }

  // ═══ Scenario 1: "carta_no_revisada" ═══
  // Restaurant creado hace 24h-7d, owner nunca hizo login, sin actividad en panel,
  // tiene lead con cartaStatus=DELIVERED.
  const cartaNoRevisadaRestaurants = await prisma.restaurant.findMany({
    where: {
      createdAt: { lt: oneDayAgo, gt: sevenDaysAgo },
      ownerId: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      owner: { select: { name: true, whatsapp: true, lastLoginAt: true } },
    },
    take: 50,
  });

  candidates.cartaNoRevisada = cartaNoRevisadaRestaurants.length;

  for (const r of cartaNoRevisadaRestaurants) {
    if (!r.owner?.whatsapp) continue;
    // Owner must have never logged in
    if (r.owner.lastLoginAt) { skipped++; continue; }

    // Must have a lead with cartaStatus=DELIVERED
    const lead = await prisma.lead.findFirst({
      where: { generatedSlug: r.slug, cartaStatus: "DELIVERED" },
      select: { id: true },
    });
    if (!lead) { skipped++; continue; }

    // Must have NO panel activity at all
    const activity = await prisma.panelActivity.findFirst({
      where: { restaurantId: r.id, action: { not: { startsWith: "nurturing_" } } },
      select: { id: true },
    });
    if (activity) { skipped++; continue; }

    await sendNurturing({
      restaurantId: r.id,
      restaurantName: r.name,
      ownerName: r.owner.name,
      whatsapp: r.owner.whatsapp,
      action: "nurturing_carta_no_revisada",
      templateSid: TEMPLATES.cartaNoRevisada,
    });
  }

  // ═══ Scenario 2: "vio_no_activo" ═══
  // Tiene lead con emailClickedAt o whatsappClickedAt, pero plan FREE y no trial.
  const vioNoActivoLeads = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED",
      generatedSlug: { not: null },
      whatsapp: { not: null },
      OR: [
        { emailClickedAt: { not: null } },
        { whatsappClickedAt: { not: null } },
      ],
    },
    select: {
      id: true,
      ownerName: true,
      localName: true,
      whatsapp: true,
      generatedSlug: true,
    },
    take: 50,
  });

  candidates.vioNoActivo = vioNoActivoLeads.length;

  for (const lead of vioNoActivoLeads) {
    if (!lead.whatsapp || !lead.generatedSlug) continue;

    // Find the restaurant — must be FREE and not trialing
    const rest = await prisma.restaurant.findFirst({
      where: {
        slug: lead.generatedSlug,
        plan: "FREE",
        subscriptionStatus: "NONE",
      },
      select: {
        id: true,
        name: true,
        owner: { select: { name: true, whatsapp: true } },
      },
    });
    if (!rest) { skipped++; continue; }

    // Use owner whatsapp if available, otherwise lead whatsapp
    const whatsapp = rest.owner?.whatsapp || lead.whatsapp;
    const ownerName = rest.owner?.name || lead.ownerName;

    await sendNurturing({
      restaurantId: rest.id,
      restaurantName: rest.name,
      ownerName: ownerName || "Hola",
      whatsapp,
      action: "nurturing_vio_no_activo",
      templateSid: TEMPLATES.noVolvio,
    });
  }

  // ═══ Scenario 3: "no_volvio" ═══
  // Restaurant con owner, dormido (sin actividad 7+ dias).
  // Incluye restaurants SIN lead y de cualquier plan.
  const noVolvioRestaurants = await prisma.restaurant.findMany({
    where: {
      ownerId: { not: null },
      isDemo: false,
    },
    select: {
      id: true,
      name: true,
      updatedAt: true,
      owner: { select: { name: true, whatsapp: true, lastLoginAt: true } },
    },
    take: 100,
  });

  candidates.noVolvio = noVolvioRestaurants.length;

  for (const r of noVolvioRestaurants) {
    if (!r.owner?.whatsapp) continue;

    // If owner logged in within last 7 days, skip
    if (r.owner.lastLoginAt && r.owner.lastLoginAt > sevenDaysAgo) {
      skipped++;
      continue;
    }

    // Check for any panel activity in the last 7 days (excluding nurturing itself)
    const recentActivity = await prisma.panelActivity.findFirst({
      where: {
        restaurantId: r.id,
        createdAt: { gt: sevenDaysAgo },
        action: { not: { startsWith: "nurturing_" } },
      },
      select: { id: true },
    });
    if (recentActivity) { skipped++; continue; }

    // Check for recent dish edits
    const recentEdits = await prisma.dish.count({
      where: { restaurantId: r.id, updatedAt: { gt: sevenDaysAgo } },
    });
    if (recentEdits > 0) { skipped++; continue; }

    await sendNurturing({
      restaurantId: r.id,
      restaurantName: r.name,
      ownerName: r.owner.name,
      whatsapp: r.owner.whatsapp,
      action: "nurturing_no_volvio",
      templateSid: TEMPLATES.noVolvio,
    });
  }

  const durationMs = Date.now() - start;

  await prisma.cronLog.create({
    data: {
      jobName: "nurturing",
      status: errors > 0 && sent === 0 ? "error" : "success",
      durationMs,
      details: { sent, skipped, errors, candidates },
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, sent, skipped, errors, candidates, durationMs });
}
