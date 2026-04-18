/**
 * Weekly digest email template for restaurant owners.
 */

interface DigestData {
  ownerName: string;
  restaurantName: string;
  restaurantSlug: string;
  visitsThisWeek: number;
  visitsDelta: number | null;
  registeredGuests: number;
  conversionRate: number;
  topDishes: { name: string; count: number }[];
  insights: { title: string; body: string }[];
  pendingPromos: number;
  campaignsSent: number;
  campaignsOpened: number;
}

export function buildWeeklyDigest(data: DigestData): { subject: string; html: string } {
  const deltaText = data.visitsDelta !== null
    ? (data.visitsDelta > 0 ? `+${data.visitsDelta}%` : `${data.visitsDelta}%`)
    : "";
  const deltaColor = data.visitsDelta !== null && data.visitsDelta > 0 ? "#4ade80" : "#ff6b6b";

  const insightsHtml = data.insights.length > 0
    ? data.insights.map(i => `
      <div style="background:#faf8f5;border-radius:10px;padding:14px;margin-bottom:8px">
        <p style="font-weight:600;color:#0e0e0e;margin:0 0 4px;font-size:0.92rem">${i.title}</p>
        <p style="color:#666;margin:0;font-size:0.82rem;line-height:1.5">${i.body}</p>
      </div>
    `).join("")
    : '<p style="color:#888;font-size:0.85rem">Genera insights en tu dashboard para verlos aquí</p>';

  const topDishesHtml = data.topDishes.length > 0
    ? data.topDishes.map((d, i) => `
      <div style="display:flex;justify-content:space-between;padding:6px 0;${i < data.topDishes.length - 1 ? "border-bottom:1px solid #f0f0f0" : ""}">
        <span style="color:#333;font-size:0.85rem">${d.name}</span>
        <span style="color:#888;font-size:0.82rem">${d.count} vistas</span>
      </div>
    `).join("")
    : '<p style="color:#888;font-size:0.85rem">Sin datos suficientes</p>';

  const html = `<div style="font-family:'DM Sans',system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#ffffff">
  <!-- Header -->
  <div style="text-align:center;margin-bottom:28px">
    <p style="font-size:1.5rem;margin:0 0 8px">🧞</p>
    <h1 style="font-size:1.3rem;font-weight:600;color:#0e0e0e;margin:0">Resumen semanal</h1>
    <p style="font-size:0.88rem;color:#888;margin:4px 0 0">${data.restaurantName}</p>
  </div>

  <!-- Stats -->
  <div style="display:flex;gap:12px;margin-bottom:24px">
    <div style="flex:1;background:#faf8f5;border-radius:12px;padding:16px;text-align:center">
      <p style="font-size:1.6rem;font-weight:700;color:#0e0e0e;margin:0">${data.visitsThisWeek}</p>
      <p style="font-size:0.72rem;color:#888;margin:4px 0 0">Visitas</p>
      ${deltaText ? `<p style="font-size:0.7rem;color:${deltaColor};margin:2px 0 0">${deltaText} vs semana pasada</p>` : ""}
    </div>
    <div style="flex:1;background:#faf8f5;border-radius:12px;padding:16px;text-align:center">
      <p style="font-size:1.6rem;font-weight:700;color:#0e0e0e;margin:0">${data.registeredGuests}</p>
      <p style="font-size:0.72rem;color:#888;margin:4px 0 0">Registrados</p>
      <p style="font-size:0.7rem;color:#F4A623;margin:2px 0 0">${data.conversionRate}% conversión</p>
    </div>
  </div>

  <!-- Top dishes -->
  <div style="margin-bottom:24px">
    <h2 style="font-size:0.78rem;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">Platos más vistos</h2>
    ${topDishesHtml}
  </div>

  <!-- Insights -->
  <div style="margin-bottom:24px">
    <h2 style="font-size:0.78rem;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px">🧞 Insights del Genio</h2>
    ${insightsHtml}
  </div>

  <!-- Pending actions -->
  ${data.pendingPromos > 0 || data.campaignsSent > 0 ? `
  <div style="background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid rgba(244,166,35,0.2);border-radius:12px;padding:16px;margin-bottom:24px">
    ${data.pendingPromos > 0 ? `<p style="color:#92400e;font-size:0.88rem;margin:0 0 6px">🏷️ Tienes <strong>${data.pendingPromos} promociones</strong> esperando tu aprobación</p>` : ""}
    ${data.campaignsSent > 0 ? `<p style="color:#92400e;font-size:0.88rem;margin:0">📧 ${data.campaignsSent} emails enviados esta semana (${data.campaignsOpened} abiertos)</p>` : ""}
  </div>
  ` : ""}

  <!-- CTA -->
  <div style="text-align:center">
    <a href="https://quierocomer.cl/admin" style="display:inline-block;background:#F4A623;color:#0a0a0a;text-decoration:none;padding:14px 32px;border-radius:50px;font-weight:700;font-size:1rem">Ver mi dashboard</a>
  </div>
</div>`;

  return {
    subject: `📊 ${data.restaurantName} — ${data.visitsThisWeek} visitas esta semana`,
    html,
  };
}
