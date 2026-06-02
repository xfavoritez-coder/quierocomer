import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export const maxDuration = 60;

/**
 * Cron: Lead nurturing via WhatsApp — runs daily at 14:00 Chile (18:00 UTC).
 *
 * Sends a single follow-up message to leads based on their state:
 *
 * 1. Carta DELIVERED +24h, no panel visit, no activation → "¿Pudiste ver tu carta?"
 * 2. Trial activated +24h, no panel return → "¿Qué te pareció la carta?"
 *
 * Only sends once per lead (tracked via lead.events "nurturing_sent").
 * Uses the approved carta_lista_v2 template to initiate the conversation.
 * When the lead replies, the AI sales agent takes over automatically.
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

  const start = Date.now();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  // ═══ Scenario 1: Carta delivered >24h ago, no panel visit, no activation ═══
  const unactivatedLeads = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED",
      deliveredAt: { lt: oneDayAgo, gt: threeDaysAgo }, // Between 1-3 days ago
      activatedAt: null,
      panelVisitedAt: null,
      whatsapp: { not: null },
    },
    select: {
      id: true, ownerName: true, localName: true, whatsapp: true,
      generatedSlug: true, events: true,
    },
    take: 30, // Limit per cron run
  });

  for (const lead of unactivatedLeads) {
    const events = Array.isArray(lead.events) ? (lead.events as any[]) : [];
    if (events.some((e: any) => e.action === "nurturing_sent")) { skipped++; continue; }
    if (!lead.whatsapp || !lead.generatedSlug) continue;

    const ownerName = (lead.ownerName || "Hola").split(" ")[0];
    const restaurantName = lead.localName || "tu restaurante";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
    const trackUrl = `${baseUrl}/c/${lead.generatedSlug}`;

    try {
      // Use carta_lista_v2 template (already approved by Meta)
      const sid = await sendWhatsApp({
        to: lead.whatsapp,
        body: `${ownerName}, ¿pudiste ver la carta de ${restaurantName}? 👉 ${trackUrl}`,
        contentSid: "HX73cbf24831adf5448d0e4eef6cb84f41",
        contentVariables: JSON.stringify({ "1": ownerName, "2": restaurantName, "3": trackUrl }),
      });

      if (sid) {
        events.push({ ts: now.toISOString(), action: "nurturing_sent", scenario: "unactivated", sid });
        await prisma.lead.update({ where: { id: lead.id }, data: { events: events as any } });
        sent++;
        console.log(`[nurturing] Sent follow-up to ${lead.whatsapp} (${restaurantName})`);
      } else {
        errors++;
      }
    } catch (e: any) {
      console.error(`[nurturing] Error sending to ${lead.whatsapp}:`, e.message);
      errors++;
    }
  }

  // ═══ Scenario 2: Trial activated >24h ago, hasn't returned to panel ═══
  const trialNoReturn = await prisma.lead.findMany({
    where: {
      activatedAt: { lt: oneDayAgo, gt: threeDaysAgo },
      whatsapp: { not: null },
      generatedSlug: { not: null },
    },
    select: {
      id: true, ownerName: true, localName: true, whatsapp: true,
      generatedSlug: true, events: true,
    },
    take: 30,
  });

  for (const lead of trialNoReturn) {
    const events = Array.isArray(lead.events) ? (lead.events as any[]) : [];
    if (events.some((e: any) => e.action === "nurturing_trial_sent")) { skipped++; continue; }
    if (!lead.whatsapp || !lead.generatedSlug) continue;

    // Check if restaurant owner has visited panel recently
    const restaurant = await prisma.restaurant.findFirst({
      where: { slug: lead.generatedSlug },
      select: { id: true, name: true },
    });
    if (!restaurant) continue;

    // Check for recent panel activity (sessions from owner in last 24h)
    // If they've been active, skip
    const recentActivity = await prisma.session.count({
      where: { restaurantId: restaurant.id, startedAt: { gte: oneDayAgo } },
    });
    if (recentActivity > 2) { skipped++; continue; } // Active, skip

    const ownerName = (lead.ownerName || "Hola").split(" ")[0];
    const restaurantName = lead.localName || restaurant.name;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://quierocomer.cl";
    const trackUrl = `${baseUrl}/c/${lead.generatedSlug}`;

    try {
      const sid = await sendWhatsApp({
        to: lead.whatsapp,
        body: `${ownerName}, ¿qué te pareció la carta de ${restaurantName}? 👉 ${trackUrl}`,
        contentSid: "HX73cbf24831adf5448d0e4eef6cb84f41",
        contentVariables: JSON.stringify({ "1": ownerName, "2": restaurantName, "3": trackUrl }),
      });

      if (sid) {
        events.push({ ts: now.toISOString(), action: "nurturing_trial_sent", scenario: "trial_no_return", sid });
        await prisma.lead.update({ where: { id: lead.id }, data: { events: events as any } });
        sent++;
        console.log(`[nurturing] Sent trial follow-up to ${lead.whatsapp} (${restaurantName})`);
      } else {
        errors++;
      }
    } catch (e: any) {
      console.error(`[nurturing] Error sending trial to ${lead.whatsapp}:`, e.message);
      errors++;
    }
  }

  const durationMs = Date.now() - start;

  await prisma.cronLog.create({
    data: {
      jobName: "nurturing",
      status: errors > 0 && sent === 0 ? "error" : "success",
      durationMs,
      details: {
        sent, skipped, errors,
        unactivatedCandidates: unactivatedLeads.length,
        trialCandidates: trialNoReturn.length,
      },
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, sent, skipped, errors, durationMs });
}
