import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail } from "@/lib/email/sendAdminEmail";
import { getVisitorMetrics, getTopAttentionDishes } from "@/lib/admin/analyticsQueries";

export const maxDuration = 30;

export async function GET() {
  const slug = "horusvegan";
  const to = "favoritez@gmail.com";

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: { id: true, name: true, logoUrl: true, slug: true, owner: { select: { name: true } } },
  });

  if (!restaurant) return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [metrics, prevMetrics, topDishes] = await Promise.all([
    getVisitorMetrics(restaurant.id, oneWeekAgo, now),
    getVisitorMetrics(restaurant.id, twoWeeksAgo, oneWeekAgo),
    getTopAttentionDishes(restaurant.id, oneWeekAgo, now),
  ]);

  // Sessions by hour
  const hourlyRaw = await prisma.session.groupBy({
    by: ["startedAt"],
    where: { restaurantId: restaurant.id, startedAt: { gte: oneWeekAgo, lte: now } },
    _count: true,
  });

  const hourBuckets: Record<string, number> = {};
  for (let h = 10; h <= 23; h++) hourBuckets[String(h)] = 0;
  for (const s of hourlyRaw) {
    const h = String(new Date(s.startedAt).getHours());
    if (hourBuckets[h] !== undefined) hourBuckets[h] += s._count;
  }
  const visitsByHour = Object.entries(hourBuckets).map(([hour, count]) => ({ hour, count }));

  // Least viewed dishes (bottom 3 with at least 1 stat event)
  const leastViewedRaw = await prisma.statEvent.groupBy({
    by: ["dishId"],
    where: { restaurantId: restaurant.id, createdAt: { gte: oneWeekAgo }, dishId: { not: null }, eventType: "DISH_VIEW" },
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

  // Build data
  const totalVisits = metrics.totalVisitors;
  const prevVisits = prevMetrics.totalVisitors || 1;
  const delta = Math.round(((totalVisits - prevVisits) / prevVisits) * 100);
  const newClients = metrics.birthdaysSaved || 0;
  const prevClients = prevMetrics.birthdaysSaved || 0;
  const clientDelta = prevClients > 0 ? Math.round(((newClients - prevClients) / prevClients) * 100) : 0;
  const avgSessions = Math.round(metrics.totalSessions / 7);
  const topViewed = (topDishes?.dishes || []).slice(0, 3).map((d: any) => ({
    name: d.name,
    count: d.opens,
    photo: d.photo || null,
  }));

  // Peak hour
  const maxHourEntry = visitsByHour.reduce((a, b) => b.count > a.count ? b : a, { hour: "13", count: 0 });
  const peakHour = `${maxHourEntry.hour}:00 – ${Number(maxHourEntry.hour) + 1}:00`;

  // Week label
  const weekStart = oneWeekAgo.toLocaleDateString("es-CL", { day: "numeric", month: "long" });
  const weekEnd = now.toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
  const weekLabel = `${weekStart} – ${weekEnd}`;
  const ownerName = restaurant.owner?.name?.split(" ")[0] || "Hola";
  const GOLD = "#F4A623";
  const maxTop = topViewed[0]?.count || 1;
  const maxH = Math.max(...visitsByHour.map(v => v.count), 1);
  const deltaColor = delta >= 0 ? "#4ade80" : "#f87171";
  const deltaSign = delta >= 0 ? "+" : "";
  const cdColor = clientDelta >= 0 ? "#4ade80" : "#f87171";
  const cdSign = clientDelta >= 0 ? "+" : "";
  const panelUrl = "https://quierocomer.cl/panel";

  const iconClients = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const iconCake = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>`;
  const iconEyeKpi = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const iconClock = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const iconFire = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${GOLD}" stroke="none"><path d="M12 23c-3.6 0-8-2.4-8-7.7 0-3.3 2-6.1 3.4-7.9L12 2l4.6 5.4C18 9.2 20 12 20 15.3 20 20.6 15.6 23 12 23z"/></svg>`;
  const iconDown = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  const thumb = (url: string | null) => url
    ? `<img src="${url}" alt="" style="width:40px;height:40px;border-radius:12px;object-fit:cover;flex-shrink:0;" />`
    : `<div style="width:40px;height:40px;border-radius:12px;background:#1a1a1a;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px;">🍽️</div>`;

  const emailHtml = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<style>
:root { color-scheme: light dark; }
@media (prefers-color-scheme: light) {
  .em-body { background: #ffffff !important; }
  .em-card { background: #f9f6f0 !important; border-color: #e8dcc4 !important; }
  .em-text { color: #1a1a1a !important; }
  .em-text2 { color: #8a7550 !important; }
  .em-text3 { color: #b8a888 !important; }
  .em-muted { color: #ccc !important; }
  .em-bar { background: #f0e8d8 !important; }
  .em-track { background: #efe5d0 !important; }
  .em-num { background: #f0e8d8 !important; color: #b8a888 !important; }
  .em-tip { border-color: #e8dcc4 !important; color: #999 !important; }
  .em-cta { color: #fff !important; }
}
</style>
</head>
<body class="em-body" style="margin:0;padding:0;background:#0e0e0e;font-family:'Segoe UI',system-ui,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;">

  <div style="text-align:center;margin-bottom:28px;">
    ${restaurant.logoUrl
      ? `<img src="${restaurant.logoUrl}" alt="${restaurant.name}" style="height:48px;border-radius:50%;margin-bottom:12px;" />`
      : `<div style="width:52px;height:52px;border-radius:50%;background:rgba(244,166,35,0.15);display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:${GOLD};margin-bottom:12px;">${restaurant.name[0]}</div>`
    }
    <h1 class="em-text" style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#f0f0f0;margin:0 0 4px;">Tu semana en <span style="color:${GOLD};">${restaurant.name}</span></h1>
    <p class="em-text3" style="font-size:13px;color:#666;margin:0;">${weekLabel}</p>
  </div>

  <p class="em-text2" style="font-size:15px;color:#888;line-height:1.6;margin:0 0 24px;text-align:center;">${ownerName}, así se movió tu carta esta semana:</p>

  <div style="display:flex;gap:10px;margin-bottom:10px;">
    <div class="em-card" style="flex:1;background:#161616;border:1px solid #262626;border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;gap:8px;">${iconClients}<div class="em-text" style="font-size:28px;font-weight:900;color:#f0f0f0;letter-spacing:-0.04em;line-height:1;">${totalVisits}</div></div>
      <div class="em-text3" style="font-size:12px;color:#666;margin-top:8px;">Visitas totales</div>
      <div style="font-size:12px;font-weight:800;color:${deltaColor};margin-top:4px;">${deltaSign}${delta}% vs anterior</div>
    </div>
    <div class="em-card" style="flex:1;background:#161616;border:1px solid #262626;border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;gap:8px;">${iconCake}<div class="em-text" style="font-size:28px;font-weight:900;color:#f0f0f0;letter-spacing:-0.04em;line-height:1;">${newClients}</div></div>
      <div class="em-text3" style="font-size:12px;color:#666;margin-top:8px;">Cumpleaños captados</div>
      <div style="font-size:12px;font-weight:800;color:${cdColor};margin-top:4px;">${cdSign}${clientDelta}% vs anterior</div>
    </div>
  </div>
  <div style="display:flex;gap:10px;margin-bottom:24px;">
    <div class="em-card" style="flex:1;background:#161616;border:1px solid #262626;border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;gap:8px;">${iconEyeKpi}<div class="em-text" style="font-size:28px;font-weight:900;color:#f0f0f0;letter-spacing:-0.04em;line-height:1;">${avgSessions}</div></div>
      <div class="em-text3" style="font-size:12px;color:#666;margin-top:8px;">Sesiones / día</div>
    </div>
    <div class="em-card" style="flex:1;background:#161616;border:1px solid #262626;border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;gap:8px;">${iconClock}<div class="em-text" style="font-size:17px;font-weight:800;color:#f0f0f0;line-height:1;">${peakHour}</div></div>
      <div class="em-text3" style="font-size:12px;color:#666;margin-top:8px;">Hora más activa</div>
    </div>
  </div>

  ${topViewed.length > 0 ? `
  <div class="em-card" style="background:#161616;border:1px solid #262626;border-radius:20px;padding:18px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;">${iconFire}<h3 class="em-text3" style="font-size:11px;color:#666;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0;">Top 3 más vistos</h3></div>
    ${topViewed.map((d: any, i: number) => `
      <div style="display:flex;align-items:center;gap:12px;${i > 0 ? "margin-top:14px;" : ""}">
        ${thumb(d.photo)}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
            <div class="em-text" style="font-size:14px;font-weight:800;color:#f0f0f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.name}</div>
            <div style="font-size:13px;font-weight:900;color:${GOLD};flex-shrink:0;margin-left:8px;">${d.count}</div>
          </div>
          <div class="em-track" style="height:4px;background:#1a1a1a;border-radius:10px;overflow:hidden;">
            <div style="height:100%;width:${(d.count / maxTop) * 100}%;background:linear-gradient(90deg,${GOLD},#ffe0a2);border-radius:10px;"></div>
          </div>
        </div>
      </div>
    `).join("")}
  </div>` : ""}

  ${leastViewed.length > 0 ? `
  <div class="em-card" style="background:#161616;border:1px solid #262626;border-radius:20px;padding:18px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;">${iconDown}<h3 class="em-text3" style="font-size:11px;color:#666;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0;">Menos vistos</h3></div>
    ${leastViewed.map((d: any, i: number) => `
      <div style="display:flex;align-items:center;gap:10px;${i > 0 ? "margin-top:10px;" : ""}">
        <div class="em-num" style="width:28px;height:28px;border-radius:8px;background:#1a1a1a;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:800;color:#444;">${i + 1}</div>
        <div class="em-text2" style="flex:1;font-size:13px;color:#888;">${d.name}</div>
        <div class="em-text3" style="font-size:11px;font-weight:700;color:#666;flex-shrink:0;">${d.count} aperturas</div>
      </div>
    `).join("")}
    <p class="em-tip" style="font-size:12px;color:#444;margin:14px 0 0;line-height:1.5;border-top:1px solid #1e1e1e;padding-top:12px;">Estos platos podrían necesitar mejores fotos o una mejor ubicación en tu carta.</p>
  </div>` : ""}

  <div class="em-card" style="background:#161616;border:1px solid #262626;border-radius:20px;padding:18px;margin-bottom:28px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;">${iconClock}<h3 class="em-text3" style="font-size:11px;color:#666;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0;">Visitas por hora</h3></div>
    <div style="display:flex;align-items:flex-end;gap:4px;">
      ${visitsByHour.map((h) => {
        const barHeight = Math.max(4, Math.round((h.count / maxH) * 80));
        const isPeak = h.count === maxH;
        return `<div style="flex:1;text-align:center;">
          <div style="font-size:9px;font-weight:800;color:${isPeak ? GOLD : '#444'};margin-bottom:4px;">${h.count}</div>
          <div style="width:100%;height:${barHeight}px;border-radius:4px 4px 2px 2px;background:${isPeak ? `linear-gradient(to top,${GOLD},#ffe0a2)` : 'rgba(255,255,255,0.08)'};"></div>
        </div>`;
      }).join("")}
    </div>
    <div style="display:flex;gap:4px;margin-top:6px;">
      ${visitsByHour.map((h) => {
        const isPeak = h.count === maxH;
        return `<div style="flex:1;text-align:center;font-size:9px;color:${isPeak ? GOLD : '#444'};font-weight:${isPeak ? '800' : '500'};">${h.hour}h</div>`;
      }).join("")}
    </div>
  </div>

  <div style="text-align:center;margin-bottom:32px;">
    <a class="em-cta" href="${panelUrl}" style="display:inline-block;padding:14px 36px;background:${GOLD};color:#0e0e0e;font-size:15px;font-weight:800;text-decoration:none;border-radius:999px;">Ver más estadísticas en tu panel</a>
  </div>

  <div style="text-align:center;border-top:1px solid #262626;padding-top:20px;">
    <p class="em-tip" style="font-size:12px;color:#444;margin:0;line-height:1.6;">Este correo se envía cada lunes con el resumen de tu semana.<br/><a href="${panelUrl}" style="color:${GOLD};text-decoration:none;">QuieroComer</a></p>
  </div>

</div></body></html>`;

  await sendAdminEmail({
    to,
    subject: `Tu semana en ${restaurant.name} · Resumen semanal`,
    html: emailHtml,
    purpose: "weekly_summary",
  });

  return NextResponse.json({ ok: true, to, restaurant: restaurant.name });
}
