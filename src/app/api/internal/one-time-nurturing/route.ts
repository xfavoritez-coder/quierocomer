import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWhatsApp } from "@/lib/whatsapp";

export const maxDuration = 120;

const TEMPLATES = {
  cartaNoRevisada: "HX212aca9223fecaf089df099969e19a25",
  noVolvio: "HXe8201d69e53b2c6c4c2af79470c34845",
};

const BLACKLIST = new Set(["+56976485972", "+56977940643"]);

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = req.nextUrl.searchParams.get("action") || "preview";
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const wasSent = (events: any, key: string) => Array.isArray(events) && events.some((e: any) => e.action === key);

  // ── NURTURING: find 12 leads to send ──
  const s1 = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED", deliveredAt: { lt: oneDayAgo, gt: sevenDaysAgo },
      activatedAt: null, panelVisitedAt: null, emailClickedAt: null, whatsappClickedAt: null,
      whatsapp: { not: null }, generatedSlug: { not: null },
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true, events: true },
  });

  const s1b = await prisma.lead.findMany({
    where: {
      cartaStatus: "DELIVERED", deliveredAt: { lt: oneDayAgo, gt: sevenDaysAgo },
      activatedAt: null, whatsapp: { not: null }, generatedSlug: { not: null },
      OR: [{ emailClickedAt: { not: null } }, { whatsappClickedAt: { not: null } }],
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true, events: true },
  });

  const s2 = await prisma.lead.findMany({
    where: {
      activatedAt: { lt: oneDayAgo, gt: sevenDaysAgo },
      whatsapp: { not: null }, generatedSlug: { not: null },
    },
    select: { id: true, ownerName: true, localName: true, whatsapp: true, generatedSlug: true, events: true },
  });

  // Build send list
  const sendList: { id: string; ownerName: string | null; localName: string | null; whatsapp: string; generatedSlug: string; events: any; scenario: string; eventKey: string; templateSid: string }[] = [];

  // S1: already sent get re-sent, pending ones too (pick up to 5)
  const sentS1 = s1.filter(l => wasSent(l.events, "nurturing_no_revisada") && !BLACKLIST.has(l.whatsapp!));
  const pendS1 = s1.filter(l => !wasSent(l.events, "nurturing_no_revisada") && !BLACKLIST.has(l.whatsapp!));
  for (const l of [...sentS1.slice(0, 5), ...pendS1.slice(0, 5 - Math.min(sentS1.length, 5))]) {
    sendList.push({ ...l, whatsapp: l.whatsapp!, generatedSlug: l.generatedSlug!, scenario: "carta_no_revisada", eventKey: "nurturing_no_revisada", templateSid: TEMPLATES.cartaNoRevisada });
  }

  // S1b: vio pero no activó
  const sentS1b = s1b.filter(l => wasSent(l.events, "nurturing_vio_no_activo") && !BLACKLIST.has(l.whatsapp!));
  const pendS1b = s1b.filter(l => !wasSent(l.events, "nurturing_vio_no_activo") && !BLACKLIST.has(l.whatsapp!));
  for (const l of [...sentS1b.slice(0, 5), ...pendS1b.slice(0, 5 - Math.min(sentS1b.length, 5))]) {
    sendList.push({ ...l, whatsapp: l.whatsapp!, generatedSlug: l.generatedSlug!, scenario: "vio_no_activo", eventKey: "nurturing_vio_no_activo", templateSid: TEMPLATES.noVolvio });
  }

  // S2: activó no volvió
  const sentS2 = s2.filter(l => wasSent(l.events, "nurturing_no_volvio") && !BLACKLIST.has(l.whatsapp!));
  const pendS2 = s2.filter(l => !wasSent(l.events, "nurturing_no_volvio") && !BLACKLIST.has(l.whatsapp!));
  for (const l of [...sentS2.slice(0, 5), ...pendS2.slice(0, 5 - Math.min(sentS2.length, 5))]) {
    sendList.push({ ...l, whatsapp: l.whatsapp!, generatedSlug: l.generatedSlug!, scenario: "no_volvio", eventKey: "nurturing_no_volvio", templateSid: TEMPLATES.noVolvio });
  }

  // ── UNSPLASH: find all dishes with unsplash photos (raw SQL for array text search) ──
  const unsplashFiltered = await prisma.$queryRaw<{ id: string; name: string; photos: string[]; tags: string[]; restaurantName: string; restaurantSlug: string }[]>`
    SELECT d.id, d.name, d.photos, d.tags, r.name as "restaurantName", r.slug as "restaurantSlug"
    FROM "Dish" d JOIN "Restaurant" r ON d."restaurantId" = r.id
    WHERE EXISTS (SELECT 1 FROM unnest(d.photos) p WHERE p LIKE '%unsplash.com%')
  `;

  if (action === "preview") {
    return NextResponse.json({
      nurturing: sendList.map(l => ({ scenario: l.scenario, local: l.localName, owner: l.ownerName, wa: l.whatsapp })),
      unsplash: {
        total: unsplashFiltered.length,
        dishes: unsplashFiltered.slice(0, 50).map(d => ({ dish: d.name, restaurant: d.restaurantName, slug: d.restaurantSlug })),
      },
    });
  }

  // ── EXECUTE ──
  const results: any[] = [];

  // Send nurturing
  for (const l of sendList) {
    const rest = await prisma.restaurant.findFirst({ where: { slug: l.generatedSlug }, select: { name: true } });
    const restaurantName = rest?.name || l.localName || "tu restaurante";
    const ownerName = (l.ownerName || "Hola").split(" ")[0];
    try {
      const sid = await sendWhatsApp({
        to: l.whatsapp,
        body: "",
        contentSid: l.templateSid,
        contentVariables: { "1": ownerName, "2": restaurantName },
      });
      if (sid) {
        const events = Array.isArray(l.events) ? (l.events as any[]) : [];
        if (!events.some((e: any) => e.action === l.eventKey)) {
          events.push({ ts: now.toISOString(), action: l.eventKey, scenario: l.scenario, sid });
          await prisma.lead.update({ where: { id: l.id }, data: { events: events as any } });
        }
        results.push({ ok: true, wa: l.whatsapp, restaurant: restaurantName, scenario: l.scenario });
      } else {
        results.push({ ok: false, wa: l.whatsapp, error: "sid null" });
      }
    } catch (e: any) {
      results.push({ ok: false, wa: l.whatsapp, error: e.message });
    }
  }

  // Clean unsplash photos
  let cleaned = 0;
  if (unsplashFiltered.length > 0) {
    for (const d of unsplashFiltered) {
      const cleanPhotos = d.photos.filter(p => !p.includes("unsplash.com"));
      const cleanTags = (d.tags as string[]).filter(t => t !== "RECOMMENDED");
      await prisma.dish.update({
        where: { id: d.id },
        data: { photos: cleanPhotos, photoCredits: null, isPhotoReferential: false, tags: cleanTags },
      });
      cleaned++;
    }
  }

  return NextResponse.json({
    nurturing: { sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, details: results },
    unsplash: { cleaned },
  });
}
