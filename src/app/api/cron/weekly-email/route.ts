import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { buildWeeklyEmailHtml } from "@/lib/email/weeklyEmailHtml";
import { getVisitorMetrics, getTopAttentionDishes } from "@/lib/admin/analyticsQueries";

export const maxDuration = 120;

/**
 * Cron: Weekly email summary — runs every Monday at 11:11 AM Chile time.
 * Sends to all restaurants with weeklyEmailEnabled = true.
 * Demo restaurants get a one-time preview email, then get disabled.
 */
export async function GET(req: NextRequest) {
  const start = Date.now();

  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurants = await prisma.restaurant.findMany({
    where: { weeklyEmailEnabled: true, isActive: true },
    select: {
      id: true, name: true, slug: true, logoUrl: true, isDemo: true,
      owner: { select: { name: true, email: true } },
      teamMembers: {
        where: { weeklyEmailEnabled: true, status: "ACTIVE" },
        select: { email: true, name: true },
      },
    },
  });

  let sent = 0;
  let demosSent = 0;
  let errors = 0;

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const weekStart = oneWeekAgo.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
  const weekEnd = now.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

  for (const r of restaurants) {
    if (!r.owner?.email) continue;

    try {
      // Gather real data
      const [metrics, prevMetrics, topDishes] = await Promise.all([
        getVisitorMetrics(r.id, oneWeekAgo, now),
        getVisitorMetrics(r.id, twoWeeksAgo, oneWeekAgo),
        getTopAttentionDishes(r.id, oneWeekAgo, now),
      ]);

      // Sessions by hour
      const sessions = await prisma.session.findMany({
        where: { restaurantId: r.id, startedAt: { gte: oneWeekAgo, lte: now } },
        select: { startedAt: true },
      });
      const hourBuckets: Record<string, number> = {};
      for (let h = 10; h <= 23; h++) hourBuckets[String(h)] = 0;
      for (const s of sessions) {
        const h = String(new Date(s.startedAt).getHours());
        if (hourBuckets[h] !== undefined) hourBuckets[h]++;
      }
      const visitsByHour = Object.entries(hourBuckets).map(([hour, count]) => ({ hour, count }));

      // Least viewed
      const leastViewedRaw = await prisma.statEvent.groupBy({
        by: ["dishId"],
        where: { restaurantId: r.id, createdAt: { gte: oneWeekAgo }, dishId: { not: null }, eventType: "DISH_VIEW" },
        _count: { dishId: true },
        orderBy: { _count: { dishId: "asc" } },
        take: 3,
      });
      const leastDishIds = leastViewedRaw.map(d => d.dishId!);
      const leastDishes = leastDishIds.length > 0
        ? await prisma.dish.findMany({ where: { id: { in: leastDishIds } }, select: { id: true, name: true } })
        : [];
      const leastViewed = leastViewedRaw.map(d => {
        const dish = leastDishes.find(dd => dd.id === d.dishId);
        return { name: dish?.name || "Desconocido", count: d._count.dishId };
      });

      const totalVisits = metrics.totalVisitors;
      const prevVisits = prevMetrics.totalVisitors || 1;
      const visitsDelta = Math.round(((totalVisits - prevVisits) / prevVisits) * 100);
      const newClients = metrics.birthdaysSaved || 0;
      const prevClients = prevMetrics.birthdaysSaved || 0;
      const clientsDelta = prevClients > 0 ? Math.round(((newClients - prevClients) / prevClients) * 100) : 0;
      const topViewed = (topDishes?.dishes || []).slice(0, 3).map((d: any) => ({
        name: d.name, count: d.opens, photo: d.photo || null,
      }));

      const ownerName = r.owner.name?.split(" ")[0] || "Hola";

      const emailHtml = buildWeeklyEmailHtml({
        ownerName,
        restaurantName: r.name,
        logoUrl: r.logoUrl,
        weekLabel: `${weekStart} – ${weekEnd}`,
        totalVisits,
        visitsDelta,
        newClients,
        clientsDelta,
        topViewed,
        leastViewed,
        visitsByHour,
        panelUrl: "https://quierocomer.cl/panel",
        slug: r.slug,
        isDemo: r.isDemo,
      });

      // Collect all recipients: owner + active team members with email enabled
      const recipients = [r.owner.email];
      for (const tm of r.teamMembers) {
        if (!recipients.includes(tm.email)) recipients.push(tm.email);
      }

      // Send to all
      for (const to of recipients) {
        await sendAdminEmail({
          to,
          subject: r.isDemo
            ? `Vista previa: Tu semana en ${r.name}`
            : `Tu semana en ${r.name}`,
          html: emailHtml,
          purpose: "weekly_summary",
        });
      }

      sent++;

      // If demo, disable weekly email after sending once
      if (r.isDemo) {
        await prisma.restaurant.update({
          where: { id: r.id },
          data: { weeklyEmailEnabled: false },
        });
        demosSent++;
      }
    } catch (e) {
      console.error(`[weekly-email] Error for ${r.slug}:`, e);
      errors++;
    }
  }

  const durationMs = Date.now() - start;

  await prisma.cronLog.create({
    data: {
      jobName: "weekly-email",
      status: errors > 0 && sent === 0 ? "error" : "success",
      durationMs,
      details: { sent, demosSent, errors, totalRestaurants: restaurants.length },
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, sent, demosSent, errors, durationMs });
}
