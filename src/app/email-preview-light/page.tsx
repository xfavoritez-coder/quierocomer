"use client";
import { Suspense } from "react";

function EmailContent() {
  const data = {
    ownerName: "Carlos",
    restaurantName: "Alas Papas",
    logoUrl: null as string | null,
    weekLabel: "12 – 18 mayo 2026",
    totalVisits: 312,
    prevVisits: 245,
    newClients: 18,
    prevClients: 12,
    avgSessionsPerDay: 44,
    peakHour: "13:00 – 14:00",
    peakDay: "Sábado",
    topViewed: [
      { name: "Pizza Margherita", count: 89, photo: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=120&h=120&fit=crop" },
      { name: "Pasta Carbonara", count: 67, photo: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=120&h=120&fit=crop" },
      { name: "Tiramisú", count: 52, photo: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=120&h=120&fit=crop" },
    ],
    leastViewed: [
      { name: "Ensalada César", count: 4 },
      { name: "Sopa del día", count: 6 },
      { name: "Pan de ajo", count: 8 },
    ],
    visitsByHour: [
      { hour: "11", count: 12 }, { hour: "12", count: 38 }, { hour: "13", count: 67 },
      { hour: "14", count: 54 }, { hour: "15", count: 22 }, { hour: "16", count: 15 },
      { hour: "17", count: 10 }, { hour: "18", count: 8 }, { hour: "19", count: 28 },
      { hour: "20", count: 45 }, { hour: "21", count: 52 }, { hour: "22", count: 30 },
    ],
    panelUrl: "https://quierocomer.cl/panel",
  };

  const delta = Math.round(((data.totalVisits - data.prevVisits) / data.prevVisits) * 100);
  const deltaColor = delta >= 0 ? "#16a34a" : "#dc2626";
  const deltaSign = delta >= 0 ? "+" : "";
  const GOLD = "#F4A623";
  const maxTop = data.topViewed[0]?.count || 1;
  const maxH = Math.max(...data.visitsByHour.map(v => v.count));

  const bg = "#ffffff"; const card = "#f9f6f0"; const cardBorder = "#e8dcc4";
  const text = "#1a1a1a"; const text2 = "#8a7550"; const text3 = "#b8a888";
  const muted = "#d4c8b0"; const barBg = "#f0e8d8"; const barTrack = "#efe5d0";
  const numBg = "#f0e8d8"; const numColor = "#b8a888"; const tipBorder = "#e8dcc4"; const tipText = "#aaa";

  const iconClients = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  const iconCake = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/><path d="M7 4h.01"/><path d="M12 4h.01"/><path d="M17 4h.01"/></svg>`;
  const iconEyeKpi = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const iconClock = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${GOLD}" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
  const iconFire = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${GOLD}" stroke="none"><path d="M12 23c-3.6 0-8-2.4-8-7.7 0-3.3 2-6.1 3.4-7.9L12 2l4.6 5.4C18 9.2 20 12 20 15.3 20 20.6 15.6 23 12 23z"/></svg>`;
  const iconDown = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${text3}" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  const thumb = (url: string | null, fallback: string) => url
    ? `<img src="${url}" alt="" style="width:40px;height:40px;border-radius:12px;object-fit:cover;flex-shrink:0;" />`
    : `<div style="width:40px;height:40px;border-radius:12px;background:${numBg};flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:16px;">${fallback}</div>`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${bg};font-family:'Segoe UI',system-ui,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;">

  <div style="text-align:center;margin-bottom:28px;">
    ${data.logoUrl
      ? `<img src="${data.logoUrl}" alt="${data.restaurantName}" style="height:48px;border-radius:50%;margin-bottom:12px;" />`
      : `<div style="width:52px;height:52px;border-radius:50%;background:rgba(244,166,35,0.12);display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:${GOLD};margin-bottom:12px;">${data.restaurantName[0]}</div>`
    }
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:${text};margin:0 0 4px;">
      Tu semana en <span style="color:${GOLD};">${data.restaurantName}</span>
    </h1>
    <p style="font-size:13px;color:${text3};margin:0;">${data.weekLabel}</p>
  </div>

  <p style="font-size:15px;color:${text2};line-height:1.6;margin:0 0 24px;text-align:left;">
    ${data.ownerName}, así se movió tu carta esta semana:
  </p>

  <div style="display:flex;gap:10px;margin-bottom:10px;">
    <div style="flex:1;background:${card};border:1px solid ${cardBorder};border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${iconClients}
        <div style="font-size:28px;font-weight:900;color:${text};letter-spacing:-0.04em;line-height:1;">${data.totalVisits}</div>
      </div>
      <div style="font-size:12px;color:${text3};margin-top:8px;">Visitas totales</div>
      <div style="font-size:12px;font-weight:800;color:${deltaColor};margin-top:4px;">${deltaSign}${delta}% vs anterior</div>
    </div>
    <div style="flex:1;background:${card};border:1px solid ${cardBorder};border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${iconCake}
        <div style="font-size:28px;font-weight:900;color:${text};letter-spacing:-0.04em;line-height:1;">${data.newClients}</div>
      </div>
      <div style="font-size:12px;color:${text3};margin-top:8px;">Cumpleaños captados</div>
      ${(() => { const cd = data.prevClients > 0 ? Math.round(((data.newClients - data.prevClients) / data.prevClients) * 100) : 0; return `<div style="font-size:12px;font-weight:800;color:${cd >= 0 ? "#16a34a" : "#dc2626"};margin-top:4px;">${cd >= 0 ? "+" : ""}${cd}% vs anterior</div>`; })()}
    </div>
  </div>
  <div style="display:flex;gap:10px;margin-bottom:24px;">
    <div style="flex:1;background:${card};border:1px solid ${cardBorder};border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${iconEyeKpi}
        <div style="font-size:28px;font-weight:900;color:${text};letter-spacing:-0.04em;line-height:1;">${data.avgSessionsPerDay}</div>
      </div>
      <div style="font-size:12px;color:${text3};margin-top:8px;">Sesiones / día</div>
    </div>
    <div style="flex:1;background:${card};border:1px solid ${cardBorder};border-radius:16px;padding:16px;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${iconClock}
        <div style="font-size:17px;font-weight:800;color:${text};line-height:1;">${data.peakHour}</div>
      </div>
      <div style="font-size:12px;color:${text3};margin-top:8px;">Hora más activa · ${data.peakDay}</div>
    </div>
  </div>

  <div style="background:${card};border:1px solid ${cardBorder};border-radius:20px;padding:18px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;">
      ${iconFire}
      <h3 style="font-size:11px;color:${text3};font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0;">Top 3 más vistos</h3>
    </div>
    ${data.topViewed.map((d, i) => `
      <div style="display:flex;align-items:center;gap:12px;${i > 0 ? "margin-top:14px;" : ""}">
        ${thumb(d.photo, "🍽️")}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
            <div style="font-size:14px;font-weight:800;color:${text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${d.name}</div>
            <div style="font-size:13px;font-weight:900;color:${GOLD};flex-shrink:0;margin-left:8px;">${d.count}</div>
          </div>
          <div style="height:4px;background:${barTrack};border-radius:10px;overflow:hidden;">
            <div style="height:100%;width:${(d.count / maxTop) * 100}%;background:linear-gradient(90deg,${GOLD},#ffe0a2);border-radius:10px;"></div>
          </div>
        </div>
      </div>
    `).join("")}
  </div>

  <div style="background:${card};border:1px solid ${cardBorder};border-radius:20px;padding:18px;margin-bottom:16px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;">
      ${iconDown}
      <h3 style="font-size:11px;color:${text3};font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0;">Menos vistos</h3>
    </div>
    ${data.leastViewed.map((d, i) => `
      <div style="display:flex;align-items:center;gap:10px;${i > 0 ? "margin-top:10px;" : ""}">
        <div style="width:28px;height:28px;border-radius:8px;background:${numBg};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:800;color:${numColor};">${i + 1}</div>
        <div style="flex:1;font-size:13px;color:${text2};">${d.name}</div>
        <div style="font-size:11px;font-weight:700;color:${text3};flex-shrink:0;">${d.count} aperturas</div>
      </div>
    `).join("")}
    <p style="font-size:12px;color:${tipText};margin:14px 0 0;line-height:1.5;border-top:1px solid ${tipBorder};padding-top:12px;">Estos platos podrían necesitar mejores fotos o una mejor ubicación en tu carta.</p>
  </div>

  <div style="background:${card};border:1px solid ${cardBorder};border-radius:20px;padding:18px;margin-bottom:28px;">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:16px;">
      ${iconClock}
      <h3 style="font-size:11px;color:${text3};font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0;">Visitas por hora</h3>
    </div>
    <div style="display:flex;align-items:flex-end;gap:4px;">
      ${data.visitsByHour.map((h) => {
        const barHeight = Math.max(4, Math.round((h.count / maxH) * 80));
        const isPeak = h.count === maxH;
        return `<div style="flex:1;text-align:center;">
          <div style="font-size:9px;font-weight:800;color:${isPeak ? GOLD : muted};margin-bottom:4px;">${h.count}</div>
          <div style="width:100%;height:${barHeight}px;border-radius:4px 4px 2px 2px;background:${isPeak ? `linear-gradient(to top,${GOLD},#ffe0a2)` : barBg};"></div>
        </div>`;
      }).join("")}
    </div>
    <div style="display:flex;gap:4px;margin-top:6px;">
      ${data.visitsByHour.map((h) => {
        const isPeak = h.count === maxH;
        return `<div style="flex:1;text-align:center;font-size:9px;color:${isPeak ? GOLD : muted};font-weight:${isPeak ? '800' : '500'};">${h.hour}h</div>`;
      }).join("")}
    </div>
  </div>

  <div style="text-align:center;margin-bottom:32px;">
    <a href="${data.panelUrl}" style="display:inline-block;padding:14px 36px;background:${GOLD};color:#fff;font-size:15px;font-weight:800;text-decoration:none;border-radius:999px;">
      Ver más estadísticas en tu panel
    </a>
  </div>

  <div style="text-align:center;border-top:1px solid ${cardBorder};padding-top:20px;">
    <p style="font-size:12px;color:${tipText};margin:0;line-height:1.6;">
      Este correo se envía cada lunes con el resumen de tu semana.<br/>
      <a href="${data.panelUrl}" style="color:${GOLD};text-decoration:none;">QuieroComer</a>
    </p>
  </div>

</div>
</body>
</html>`;

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function EmailPreviewLight() {
  return <Suspense><EmailContent /></Suspense>;
}
