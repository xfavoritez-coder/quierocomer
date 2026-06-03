import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export const maxDuration = 60;

// Template SIDs (Meta approval pending — fallback to carta_lista_v2 if not yet approved)
const TEMPLATES = {
  cartaNoRevisada: "HX212aca9223fecaf089df099969e19a25",
  onboardingIncompleto: "HX5b196800fee3fde1de075c604bc5d598",
  noVolvio: "HXe8201d69e53b2c6c4c2af79470c34845",
  // Fallback if new templates aren't approved yet
  cartaLista: "HX73cbf24831adf5448d0e4eef6cb84f41",
};

/**
 * Cron: Lead nurturing via WhatsApp — runs daily at 16:00 Chile (20:00 UTC).
 *
 * 3 scenarios, all sent as "Camila de QuieroComer":
 *
 * 1. Carta DELIVERED +24h, no la revisó (no panel visit, no onboarding) → camila_carta_no_revisada
 * 2. Vio carta pero no terminó onboarding (onboardingDoneAt null) → camila_onboarding_incompleto
 * 3. Activó trial, hizo onboarding, pero no volvió al panel → camila_no_volvio
 *
 * Each scenario sends once per lead (tracked via lead.events).
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

  // ── Test mode: ?test=+56999946208&scenario=onboarding_incompleto ──
  const rawTestPhone = req.nextUrl.searchParams.get("test");
  const testPhone = rawTestPhone?.trim().replace(/^\s/, "+") || null;
  if (testPhone) {
    const scenarioMap: Record<string, string> = {
      carta_no_revisada: TEMPLATES.cartaNoRevisada,
      onboarding_incompleto: TEMPLATES.onboardingIncompleto,
      no_volvio: TEMPLATES.noVolvio,
    };
    const scenarioKey = req.nextUrl.searchParams.get("scenario") || "onboarding_incompleto";
    const templateSid = scenarioMap[scenarioKey];
    if (!templateSid) return NextResponse.json({ error: `Scenario inválido: ${scenarioKey}`, valid: Object.keys(scenarioMap) }, { status: 400 });

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
  // Números excluidos del nurturing
  const BLACKLIST = new Set(["+56976485972"]); // Il Mascalzone

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  async function sendNurturing(
    lead: { id: string; ownerName: string | null; localName: string | null; whatsapp: string | null; generatedSlug: string | null; events: any },
    scenario: string,
    eventKey: string,
    templateSid: string,
  ) {
    const events = Array.isArray(lead.events) ? (lead.events as any[]) : [];
    if (events.some((e: any) => e.action === eventKey)) { skipped++; return; }
    if (!lead.whatsapp || !lead.generatedSlug) return;
    if (BLACKLIST.has(lead.whatsapp)) { skipped++; return; }

    const ownerName = (lead.ownerName || "Hola").split(" ")[0];

    // Resolve restaurant name from DB (more accurate than lead.localName)
    const rest = await prisma.restaurant.findFirst({
      where: { slug: lead.generatedSlug },
      select: { name: true },
    });
    const restaurantName = rest?.name || lead.localName || "tu restaurante";

    try {
      const sid = await sendWhatsApp({
        to: lead.whatsapp,
        body: "", // Template handles the body
        contentSid: templateSid,
        contentVariables: { "1": ownerName, "2": restaurantName },
      });

      if (sid) {
        events.push({ ts: now.toISOString(), action: eventKey, scenario, sid });
        await prisma.lead.update({ where: { id: lead.id }, data: { events: events as any } });
        sent++;
        console.log(`[nurturing] ${scenario}: ${lead.whatsapp} (${restaurantName})`);
      } else {
        errors++;
      }
    } catch (e: any) {
      console.error(`[nurturing] ${scenario} error for ${lead.whatsapp}:`, e.message);
      errors++;
    }
  }

  // ═══ Scenario 1: Carta lista, no la revisó ═══
  // deliveredAt between 24h-7d ago, no panel visit, no activation
  const noRevisada = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED",
      deliveredAt: { lt: oneDayAgo, gt: sevenDaysAgo },
      activatedAt: null,
      panelVisitedAt: null,
      whatsapp: { not: null },
      generatedSlug: { not: null },
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true, events: true },
    take: 30,
  });

  for (const lead of noRevisada) {
    await sendNurturing(lead, "carta_no_revisada", "nurturing_no_revisada", TEMPLATES.cartaNoRevisada);
  }

  // ═══ Scenario 2: Vio carta pero no activó ═══
  // Has some engagement (clicked email/WA or visited panel) but hasn't activated
  const onboardingIncompleto = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED",
      deliveredAt: { lt: oneDayAgo, gt: sevenDaysAgo },
      activatedAt: null,
      whatsapp: { not: null },
      generatedSlug: { not: null },
      OR: [
        { emailClickedAt: { not: null } },
        { whatsappClickedAt: { not: null } },
        { panelVisitedAt: { not: null } },
      ],
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true, events: true },
    take: 30,
  });

  for (const lead of onboardingIncompleto) {
    // Skip if already sent scenario 1 (avoid double-messaging)
    const events = Array.isArray(lead.events) ? (lead.events as any[]) : [];
    if (events.some((e: any) => e.action === "nurturing_no_revisada")) { skipped++; continue; }
    await sendNurturing(lead, "onboarding_incompleto", "nurturing_onboarding", TEMPLATES.onboardingIncompleto);
  }

  // ═══ Scenario 3: Activó trial pero no volvió ═══
  // activatedAt between 24h-7d ago, but restaurant owner hasn't visited panel recently
  const noVolvio = await prisma.lead.findMany({
    where: {
      activatedAt: { lt: oneDayAgo, gt: sevenDaysAgo },
      whatsapp: { not: null },
      generatedSlug: { not: null },
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true, events: true },
    take: 30,
  });

  for (const lead of noVolvio) {
    if (!lead.generatedSlug) continue;

    // Check if owner has been active in the panel recently (edits, uploads, etc.)
    const restaurant = await prisma.restaurant.findFirst({
      where: { slug: lead.generatedSlug },
      select: { id: true, updatedAt: true },
    });
    if (!restaurant) continue;

    // If restaurant was updated in the last 24h, they're using it — skip
    if (restaurant.updatedAt > oneDayAgo) { skipped++; continue; }

    // Check for recent dish edits
    const recentEdits = await prisma.dish.count({
      where: { restaurantId: restaurant.id, updatedAt: { gt: oneDayAgo } },
    });
    if (recentEdits > 0) { skipped++; continue; }

    await sendNurturing(lead, "no_volvio", "nurturing_no_volvio", TEMPLATES.noVolvio);
  }

  const durationMs = Date.now() - start;

  await prisma.cronLog.create({
    data: {
      jobName: "nurturing",
      status: errors > 0 && sent === 0 ? "error" : "success",
      durationMs,
      details: {
        sent, skipped, errors,
        candidates: { noRevisada: noRevisada.length, onboardingIncompleto: onboardingIncompleto.length, noVolvio: noVolvio.length },
      },
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, sent, skipped, errors, durationMs });
}
