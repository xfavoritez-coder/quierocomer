import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildWeeklyDigest } from "@/lib/email/templates/weeklyDigest";

/**
 * Weekly cron DESHABILITADO — el dueño pidio quitar el digest semanal.
 * Removido de vercel.json. El endpoint queda como 410 Gone para que si por
 * algun motivo se invoca, no envie correos. Para reactivar: agregar la
 * entrada en vercel.json y quitar el guard de abajo.
 */
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  return NextResponse.json({ ok: false, disabled: true, message: "Weekly digest disabled" }, { status: 410 });

  // eslint-disable-next-line no-unreachable
  const start = Date.now();

  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    // Get all owners with restaurants
    const owners = await prisma.restaurantOwner.findMany({
      include: { restaurants: { where: { isActive: true }, select: { id: true, name: true, slug: true } } },
    });

    let sent = 0;
    let failed = 0;

    for (const owner of owners) {
      for (const restaurant of owner.restaurants) {
        try {
          // Gather stats
          const [visitsThisWeek, visitsLastWeek, registeredGuests, totalGuests, topViewed, insights, pendingPromos, campaignsSent] = await Promise.all([
            prisma.statEvent.count({ where: { restaurantId: restaurant.id, eventType: "SESSION_START", createdAt: { gte: weekAgo } } }),
            prisma.statEvent.count({ where: { restaurantId: restaurant.id, eventType: "SESSION_START", createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
            prisma.guestProfile.count({ where: { linkedQrUserId: { not: null }, sessions: { some: { restaurantId: restaurant.id } } } }),
            prisma.guestProfile.count({ where: { sessions: { some: { restaurantId: restaurant.id } } } }),
            prisma.statEvent.groupBy({
              by: ["dishId"], where: { restaurantId: restaurant.id, eventType: "DISH_VIEW", dishId: { not: null }, createdAt: { gte: weekAgo } },
              _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 5,
            }),
            prisma.genioInsight.findMany({ where: { restaurantId: restaurant.id, status: "active" }, take: 3, orderBy: { priority: "asc" } }),
            prisma.promotion.count({ where: { restaurantId: restaurant.id, status: "SUGGESTED" } }),
            prisma.campaign.count({ where: { restaurantId: restaurant.id, status: "SENT", sentAt: { gte: weekAgo } } }),
          ]);

          // Skip if no activity
          if (visitsThisWeek === 0 && visitsLastWeek === 0) continue;

          // Resolve dish names
          const dishIds = topViewed.filter((t: any) => t.dishId).map((t: any) => t.dishId!);
          const dishNames = dishIds.length ? await prisma.dish.findMany({ where: { id: { in: dishIds } }, select: { id: true, name: true } }) : [];
          const dishMap = Object.fromEntries(dishNames.map(d => [d.id, d.name]));

          const visitsDelta = visitsLastWeek > 0 ? Math.round(((visitsThisWeek - visitsLastWeek) / visitsLastWeek) * 100) : null;

          const { subject, html } = buildWeeklyDigest({
            ownerName: owner.name,
            restaurantName: restaurant.name,
            restaurantSlug: restaurant.slug,
            visitsThisWeek,
            visitsDelta,
            registeredGuests,
            conversionRate: totalGuests > 0 ? Math.round((registeredGuests / totalGuests) * 100) : 0,
            topDishes: topViewed.map((t: any) => ({ name: dishMap[t.dishId!] || "?", count: t._count.id })),
            insights: insights.map(i => ({ title: i.title, body: i.body })),
            pendingPromos,
            campaignsSent,
            campaignsOpened: 0, // TODO: count opens
          });

          // Add unsubscribe + tracking
          const pixelUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://quierocomer.cl"}/api/campaigns/track/open?cid=digest-${restaurant.id}&uid=${owner.id}`;
          const fullHtml = html + `<img src="${pixelUrl}" width="1" height="1" style="display:none" />`;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: process.env.FROM_EMAIL || "QuieroComer <noreply@quierocomer.cl>",
              to: owner.email,
              subject,
              html: fullHtml,
            }),
            signal: AbortSignal.timeout(10000),
          });

          sent++;
        } catch (e) {
          console.error(`Digest error for ${restaurant.name}:`, e);
          failed++;
        }
      }
    }

    const durationMs = Date.now() - start;
    await prisma.cronLog.create({
      data: { jobName: "weekly-digest", status: "success", durationMs, details: { sent, failed } },
    });

    return NextResponse.json({ ok: true, sent, failed, durationMs });
  } catch (error) {
    const durationMs = Date.now() - start;
    await prisma.cronLog.create({
      data: { jobName: "weekly-digest", status: "error", durationMs, error: (error as Error).message },
    }).catch(() => {});
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
