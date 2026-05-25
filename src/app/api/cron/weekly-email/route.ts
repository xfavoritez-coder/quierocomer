import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { buildWeeklyEmailHtml } from "@/lib/email/weeklyEmailHtml";
import { buildTrialWeek1Html, buildTrialWeek2Html } from "@/app/api/preview-email/weekly-trial/route";
import { getVisitorMetrics, getTopAttentionDishes } from "@/lib/admin/analyticsQueries";
import { generateInsights } from "@/lib/genio/generateInsights";
import { chileHourOf } from "@/lib/toteat/timezone";

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

  // ═══ Phase 1: Generate Genio insights for non-demo restaurants that need them ═══
  // Only restaurants that have weeklyInsightsEnabled=true OR weeklyEmailEnabled=true
  // AND are not demo, so we don't waste API tokens.
  let insightsGenerated = 0;
  const insightCandidates = await prisma.restaurant.findMany({
    where: {
      isActive: true,
      isDemo: false,
      OR: [
        { weeklyInsightsEnabled: true },
        { weeklyEmailEnabled: true },
      ],
    },
    select: { id: true, slug: true },
  });

  for (const r of insightCandidates) {
    try {
      await prisma.genioInsight.updateMany({
        where: { restaurantId: r.id, status: "active" },
        data: { status: "dismissed" },
      });
      const newInsights = await generateInsights(r.id);
      for (const ins of newInsights) {
        await prisma.genioInsight.create({
          data: {
            restaurantId: r.id,
            type: ins.type, title: ins.title, body: ins.body,
            priority: ins.priority, data: ins.data,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });
      }
      insightsGenerated += newInsights.length;
    } catch (e) {
      console.error(`[weekly-email] Insight generation failed for ${r.slug}:`, e);
    }
  }

  // ═══ Phase 2: Send weekly emails ═══
  // Fetch all active restaurants — filtering recipients per-user below
  const restaurants = await prisma.restaurant.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, slug: true, logoUrl: true, isDemo: true, createdAt: true, trialEndsAt: true,
      weeklyEmailEnabled: true,
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
      const ownerName = r.owner.name?.split(" ")[0] || "Hola";
      let emailHtml: string = "";
      let emailSubject = `Tu semana en ${r.name}`;

      // Route to the right email based on restaurant state
      if (!r.isDemo) {
        const sessionCount = await prisma.session.count({
          where: { restaurantId: r.id, startedAt: { gte: oneWeekAgo } },
        });
        const daysActive = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / 86400000);

        if (daysActive < 7) {
          // Week 1: "Así será tu informe semanal" — preview con datos fake
          const dishes = await prisma.dish.findMany({
            where: { restaurantId: r.id, isActive: true },
            select: { name: true },
            orderBy: { position: "asc" },
            take: 5,
          });
          const cats = await prisma.category.count({ where: { restaurantId: r.id, isActive: true } });
          const trialEnd = r.trialEndsAt ? Math.max(0, Math.ceil((new Date(r.trialEndsAt).getTime() - now.getTime()) / 86400000)) : 14;
          emailHtml = buildTrialWeek1Html({
            ownerName,
            restaurantName: r.name,
            logoUrl: r.logoUrl,
            daysLeft: trialEnd,
            totalDishes: dishes.length,
            categories: cats,
            topDishes: dishes.slice(0, 3).map(d => d.name),
            panelUrl: `https://quierocomer.cl/panel`,
            slug: r.slug,
          });
          emailSubject = `${r.name} · Tu primera semana`;
          console.log(`[weekly-email] ${r.name}: Week 1 trial email (${daysActive}d active, ${sessionCount} sessions)`);

        } else if (daysActive < 21 && sessionCount < 10) {
          // Week 2+: motivacional con checklist de progreso
          const totalDishes = await prisma.dish.count({ where: { restaurantId: r.id, isActive: true } });
          const photosUploaded = await prisma.dish.count({ where: { restaurantId: r.id, photos: { isEmpty: false }, isPhotoReferential: false } });
          const dishesEdited = await prisma.dish.count({ where: { restaurantId: r.id, updatedAt: { gt: r.createdAt } } });
          const trialEnd = r.trialEndsAt ? Math.max(0, Math.ceil((new Date(r.trialEndsAt).getTime() - now.getTime()) / 86400000)) : 0;
          emailHtml = buildTrialWeek2Html({
            ownerName,
            restaurantName: r.name,
            logoUrl: r.logoUrl,
            daysLeft: trialEnd,
            totalVisits: sessionCount,
            photosUploaded,
            dishesEdited,
            totalDishes,
            panelUrl: `https://quierocomer.cl/panel`,
            slug: r.slug,
          });
          emailSubject = `${r.name} · ¿Cómo va tu carta?`;
          console.log(`[weekly-email] ${r.name}: Week 2 motivational (${daysActive}d active, ${sessionCount} sessions)`);

        } else {
          // Normal: has enough data — fall through to real email below
        }
      } // end !r.isDemo routing

      // If emailHtml was set by trial routing, skip to send
      if (!emailHtml && r.isDemo) {
        // Demo restaurants: fake data preview
        const dishes = await prisma.dish.findMany({
          where: { restaurantId: r.id, isActive: true },
          select: { name: true, photos: true },
          orderBy: { position: "asc" },
          take: 5,
        });
        const topViewed = dishes.slice(0, 3).map((d, i) => ({
          name: d.name, count: [42, 35, 28][i] || 20, photo: d.photos?.[0] || null,
        }));
        const leastViewed = dishes.slice(-3).map((d, i) => ({
          name: d.name, count: [3, 5, 7][i] || 4,
        }));
        const visitsByHour = [
          { hour: "12", count: 18 }, { hour: "13", count: 32 }, { hour: "14", count: 25 },
          { hour: "19", count: 15 }, { hour: "20", count: 38 }, { hour: "21", count: 42 },
          { hour: "22", count: 20 },
        ];
        const demoInsight = {
          title: topViewed[0] ? `Destaca ${topViewed[0].name}` : "Tu carta está lista",
          body: topViewed[0]
            ? `Tu plato más visto recibe mucha atención pero no está marcado como recomendado. Agrégale la etiqueta para que aparezca primero y veas cómo aumenta tu venta.`
            : "Al activar empezarás a ver datos reales de cómo interactúan tus clientes con tu carta.",
        };
        emailHtml = buildWeeklyEmailHtml({
          ownerName,
          restaurantName: r.name,
          logoUrl: r.logoUrl,
          weekLabel: `${weekStart} – ${weekEnd}`,
          totalVisits: 147,
          visitsDelta: 23,
          newClients: 12,
          clientsDelta: 15,
          topViewed,
          leastViewed,
          visitsByHour,
          panelUrl: `https://quierocomer.cl/api/panel/demo-auth?slug=${r.slug}`,
          slug: r.slug,
          isDemo: true,
          insight: demoInsight,
        });
      } else if (!emailHtml) {
        // Real restaurants: use actual data
        const [metrics, prevMetrics, topDishes] = await Promise.all([
          getVisitorMetrics(r.id, oneWeekAgo, now),
          getVisitorMetrics(r.id, twoWeeksAgo, oneWeekAgo),
          getTopAttentionDishes(r.id, oneWeekAgo, now),
        ]);

        const sessions = await prisma.session.findMany({
          where: { restaurantId: r.id, startedAt: { gte: oneWeekAgo, lte: now } },
          select: { startedAt: true },
        });
        const hourBuckets: Record<string, number> = {};
        for (let h = 10; h <= 23; h++) hourBuckets[String(h)] = 0;
        for (const s of sessions) {
          const h = String(chileHourOf(new Date(s.startedAt)));
          if (hourBuckets[h] !== undefined) hourBuckets[h]++;
        }
        const visitsByHour = Object.entries(hourBuckets).map(([hour, count]) => ({ hour, count }));

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

        // Fetch the top-priority active insight; fallback to basic tip from data
        let topInsight: { title: string; body: string } | null = await prisma.genioInsight.findFirst({
          where: { restaurantId: r.id, status: "active" },
          orderBy: { priority: "asc" },
          select: { title: true, body: true },
        });
        if (!topInsight && topViewed.length > 0) {
          topInsight = {
            title: `${topViewed[0].name} lidera tu carta`,
            body: `Con ${topViewed[0].count} vistas esta semana, es tu plato estrella. Asegúrate de que tenga buena foto y esté marcado como destacado para aprovechar su potencial.`,
          };
        }
        if (!topInsight) {
          topInsight = {
            title: "Pon tu QR en las mesas",
            body: "Cuantas más personas escaneen tu carta, mejores datos tendrás para tomar decisiones. Imprime el QR desde tu panel y ponlo visible en cada mesa.",
          };
        }

        emailHtml = buildWeeklyEmailHtml({
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
          isDemo: false,
          insight: topInsight || undefined,
        });
      }

      // Collect recipients: owner gets it if restaurant.weeklyEmailEnabled,
      // team members get it if their own weeklyEmailEnabled is true
      const recipients: string[] = [];
      if (r.weeklyEmailEnabled && r.owner.email) recipients.push(r.owner.email);
      for (const tm of r.teamMembers) {
        if (!recipients.includes(tm.email)) recipients.push(tm.email);
      }
      if (recipients.length === 0) continue;

      // Send to all with tracking
      const baseUrl = "https://quierocomer.cl";
      for (const to of recipients) {
        // Pre-create log to get ID for tracking
        const log = await prisma.emailLog.create({
          data: { to, subject: emailSubject, purpose: "weekly_summary", status: "pending" },
        }).catch(() => null);
        const eid = log?.id || "";

        // Inject tracking pixel and wrap panel link with click tracker
        let trackedHtml = emailHtml;
        if (eid) {
          const openPixel = `<img src="${baseUrl}/api/funnel/track/weekly-open?eid=${eid}" width="1" height="1" style="display:none" />`;
          trackedHtml = trackedHtml.replace("</body>", `${openPixel}</body>`);
          // Wrap panel URL with click tracker
          trackedHtml = trackedHtml.replace(
            /href="(https:\/\/quierocomer\.cl\/panel[^"]*)"/g,
            `href="${baseUrl}/api/funnel/track/weekly-click?eid=${eid}&url=$1"`
          );
        }

        try {
          await sendAdminEmail({
            to,
            subject: emailSubject,
            html: trackedHtml,
            purpose: "weekly_summary",
            skipLog: true,
          });
          if (log) await prisma.emailLog.update({ where: { id: log.id }, data: { status: "sent" } }).catch(() => {});
        } catch {
          if (log) await prisma.emailLog.update({ where: { id: log.id }, data: { status: "failed" } }).catch(() => {});
        }
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
      details: { sent, demosSent, errors, insightsGenerated, totalRestaurants: restaurants.length, insightCandidates: insightCandidates.length },
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, sent, demosSent, errors, insightsGenerated, durationMs });
}
