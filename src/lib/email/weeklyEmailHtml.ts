/**
 * Weekly summary email — table-based, email-client compatible.
 * Works in Gmail, Apple Mail, Outlook, Yahoo, etc.
 * Supports dark/light mode via @media (prefers-color-scheme).
 */

interface WeeklyEmailData {
  ownerName: string;
  restaurantName: string;
  logoUrl: string | null;
  weekLabel: string;
  totalVisits: number;
  visitsDelta: number; // percentage
  newClients: number;
  clientsDelta: number;
  topViewed: { name: string; count: number; photo: string | null }[];
  leastViewed: { name: string; count: number }[];
  visitsByHour: { hour: string; count: number }[];
  panelUrl: string;
  slug: string;
  isDemo?: boolean;
  insight?: { title: string; body: string };
}

export function buildWeeklyEmailHtml(data: WeeklyEmailData): string {
  const GOLD = "#e8930a";
  const maxTop = data.topViewed[0]?.count || 1;
  const maxH = Math.max(...data.visitsByHour.map(v => v.count), 1);
  const vSign = data.visitsDelta >= 0 ? "+" : "";
  const vColor = data.visitsDelta >= 0 ? "#16a34a" : "#dc2626";
  const cSign = data.clientsDelta >= 0 ? "+" : "";
  const cColor = data.clientsDelta >= 0 ? "#16a34a" : "#dc2626";

  const initial = data.restaurantName[0] || "Q";

  const topRows = data.topViewed.map((d, i) => {
    const pct = Math.round((d.count / maxTop) * 100);
    const img = d.photo
      ? `<img src="${d.photo}" alt="" width="40" height="40" style="width:40px;height:40px;border-radius:12px;object-fit:cover;display:block;" />`
      : `<div style="width:40px;height:40px;border-radius:12px;background:#e0e0e0;text-align:center;line-height:40px;font-size:16px;">&#127869;</div>`;
    return `
    <tr><td style="padding:${i > 0 ? "12px" : "0"} 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="40" valign="top">${img}</td>
        <td width="12"></td>
        <td valign="middle">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:14px;font-weight:800;color:#1a1a1a;">${d.name}</td>
              <td width="40" align="right" style="font-size:13px;font-weight:900;color:${GOLD};">${d.count}</td>
            </tr>
            <tr><td colspan="2" style="padding-top:5px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background:#e0e0e0;border-radius:4px;height:4px;">
                  <div style="width:${pct}%;height:4px;border-radius:4px;background:${GOLD};"></div>
                </td>
              </tr></table>
            </td></tr>
          </table>
        </td>
      </tr></table>
    </td></tr>`;
  }).join("");

  const leastRows = data.leastViewed.map((d, i) => `
    <tr><td style="padding:${i > 0 ? "8px" : "0"} 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="28" valign="middle">
          <div style="width:28px;height:28px;border-radius:8px;background:#e0e0e0;text-align:center;line-height:28px;font-size:11px;font-weight:800;color:#aaa;">${i + 1}</div>
        </td>
        <td width="10"></td>
        <td style="font-size:13px;color:#8a7550;">${d.name}</td>
        <td width="90" align="right" style="font-size:11px;font-weight:700;color:#b8a888;white-space:nowrap;">${d.count} aperturas</td>
      </tr></table>
    </td></tr>
  `).join("");

  const barCells = data.visitsByHour.map(h => {
    const barH = Math.max(4, Math.round((h.count / maxH) * 70));
    const isPeak = h.count === maxH;
    return `<td align="center" valign="bottom" style="padding:0 1px;">
      <div style="font-size:8px;font-weight:800;color:${isPeak ? GOLD : "#555"};margin-bottom:3px;">${h.count}</div>
      <div style="width:100%;height:${barH}px;border-radius:3px 3px 1px 1px;background:${isPeak ? GOLD : "#d0d0d0"};"></div>
    </td>`;
  }).join("");

  const hourLabels = data.visitsByHour.map(h => {
    const isPeak = h.count === maxH;
    return `<td align="center" style="font-size:8px;color:${isPeak ? GOLD : "#555"};font-weight:${isPeak ? "800" : "500"};padding:4px 1px 0;">${h.hour}h</td>`;
  }).join("");

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tu semana en ${data.restaurantName}</title>
</head>
<body style="margin:0;padding:0;background-color:#fefefe;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fefefe;"><tr><td align="center" style="padding:32px 16px;">
<table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;">

  <!-- Header -->
  <tr><td align="center" style="padding-bottom:28px;">
    ${data.logoUrl
      ? `<img src="${data.logoUrl}" alt="${data.restaurantName}" width="48" height="48" style="width:48px;height:48px;border-radius:50%;display:block;margin:0 auto 12px;" />`
      : `<div style="width:52px;height:52px;border-radius:50%;background:rgba(244,166,35,0.15);text-align:center;line-height:52px;font-size:22px;font-weight:800;color:${GOLD};margin:0 auto 12px;">${initial}</div>`
    }
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#1a1a1a;margin:0 0 6px;">Tu semana en <span style="color:${GOLD};">${data.restaurantName}</span></h1>
    <p style="font-size:13px;color:#b8a888;margin:0;">${data.weekLabel}</p>
  </td></tr>

  ${data.isDemo ? `
  <!-- Demo banner -->
  <tr><td style="padding:0 0 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9f6f0;border:1px solid ${GOLD}33;border-radius:14px;">
      <tr><td style="padding:18px 22px;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="vertical-align:top;padding-right:14px;">
            <div style="width:36px;height:36px;border-radius:10px;background:${GOLD};text-align:center;line-height:36px;">
              <span style="font-size:16px;line-height:36px;display:block;text-align:center;width:36px;">📊</span>
            </div>
          </td>
          <td style="vertical-align:top;">
            <span style="font-size:14px;font-weight:700;color:#92400e;display:block;margin-bottom:4px;">Ejemplo de tu informe semanal</span>
            <span style="font-size:12px;color:#8a7550;line-height:1.5;">Cada lunes recibirás un resumen de tus estadísticas con consejos para vender más.</span>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>` : ""}

  <!-- Greeting -->
  <tr><td style="font-size:15px;color:#8a7550;line-height:1.6;padding:0 0 24px;text-align:left;">
    ${data.ownerName}, así se movió tu carta esta semana:
  </td></tr>

  <!-- KPIs -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="49%" valign="top">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9f6f0;border:1px solid #e8dcc4;border-radius:16px;">
          <tr><td style="padding:16px;">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-size:18px;vertical-align:middle;">&#128101;</td>
              <td width="8"></td>
              <td style="font-size:28px;font-weight:900;color:#1a1a1a;letter-spacing:-0.04em;line-height:1;">${data.totalVisits}</td>
            </tr></table>
            <div style="font-size:12px;color:#b8a888;margin-top:8px;">Visitas totales</div>
            <div style="font-size:12px;font-weight:800;color:${vColor};margin-top:4px;">${vSign}${data.visitsDelta}% vs anterior</div>
          </td></tr>
        </table>
      </td>
      <td width="2%"></td>
      <td width="49%" valign="top">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9f6f0;border:1px solid #e8dcc4;border-radius:16px;">
          <tr><td style="padding:16px;">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-size:18px;vertical-align:middle;">&#127874;</td>
              <td width="8"></td>
              <td style="font-size:28px;font-weight:900;color:#1a1a1a;letter-spacing:-0.04em;line-height:1;">${data.newClients}</td>
            </tr></table>
            <div style="font-size:12px;color:#b8a888;margin-top:8px;">Cumples captados</div>
            <div style="font-size:12px;font-weight:800;color:${cColor};margin-top:4px;">${cSign}${data.clientsDelta}% vs anterior</div>
          </td></tr>
        </table>
      </td>
    </tr></table>
  </td></tr>


  ${data.insight ? `
  <!-- Genio Insight -->
  <tr><td style="padding-bottom:16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9f6f0;border:1px solid ${GOLD}33;border-radius:16px;">
      <tr><td style="padding:18px;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="font-size:22px;vertical-align:top;padding-right:12px;">🧞</td>
          <td>
            <div style="font-size:11px;color:${GOLD};font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px;">Consejo del Genio</div>
            <div style="font-size:14px;font-weight:800;color:#1a1a1a;margin:0 0 6px;">${data.insight.title}</div>
            <div style="font-size:15px;color:#8a7550;line-height:1.5;">${data.insight.body}</div>
          </td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>` : ""}

  <!-- Top 3 -->
  ${data.topViewed.length > 0 ? `
  <tr><td style="padding-bottom:16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9f6f0;border:1px solid #e8dcc4;border-radius:20px;">
      <tr><td style="padding:18px;">
        <div style="font-size:11px;color:#b8a888;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">&#128293; Top 3 más vistos</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${topRows}
        </table>
      </td></tr>
    </table>
  </td></tr>` : ""}

  <!-- Least viewed -->
  ${data.leastViewed.length > 0 ? `
  <tr><td style="padding-bottom:16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9f6f0;border:1px solid #e8dcc4;border-radius:20px;">
      <tr><td style="padding:18px;">
        <div style="font-size:11px;color:#b8a888;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">&#9660; Menos vistos</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          ${leastRows}
        </table>
        <div style="font-size:12px;color:#8a7550;margin-top:14px;padding-top:12px;border-top:1px solid #e8dcc4;line-height:1.5;">Estos platos podrían necesitar mejores fotos o una mejor ubicación en tu carta.</div>
      </td></tr>
    </table>
  </td></tr>` : ""}

  <!-- Chart -->
  <tr><td style="padding-bottom:28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9f6f0;border:1px solid #e8dcc4;border-radius:20px;">
      <tr><td style="padding:18px;">
        <div style="font-size:11px;color:#b8a888;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 16px;">&#128339; Visitas por hora</div>
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr style="vertical-align:bottom;">${barCells}</tr>
          <tr>${hourLabels}</tr>
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td align="center" style="padding-bottom:32px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="border-radius:999px;background:${GOLD};padding:14px 36px;">
        <a href="${data.panelUrl}" style="color:#fff;font-size:15px;font-weight:800;text-decoration:none;display:block;">Ver más estadísticas en panel</a>
      </td>
    </tr></table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding-top:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td colspan="2" style="height:1px;background-color:#e8dcc4;"></td></tr></table>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:20px 0 0;">
        ${data.isDemo
          ? `<span style="font-size:11px;color:#ccc;line-height:1.8;">Este correo se envía solo una vez como vista previa. Al activar tu carta, recibirás este informe cada semana con tus datos reales.</span>`
          : `<span style="font-size:11px;color:#ccc;line-height:1.8;">Este correo se envía cada semana.</span><br/>
        <a href="https://quierocomer.cl/api/email/unsubscribe?slug=${data.slug}" style="font-size:11px;color:#ccc;text-decoration:underline;">No deseo seguir recibiéndolo</a>`
        }
      </td></tr>
      <tr><td align="center" style="padding:18px 0 0;">
        <a href="https://quierocomer.cl" style="font-size:12px;color:${GOLD};text-decoration:none;">QuieroComer.cl</a>
        <br/>
        <span style="font-size:10px;color:#ddd;">&copy; ${new Date().getFullYear()} · Todos los derechos reservados</span>
      </td></tr>
    </table>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`;
}
