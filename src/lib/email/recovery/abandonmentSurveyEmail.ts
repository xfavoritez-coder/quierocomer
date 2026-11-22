// Email de recuperación: encuesta de abandono con razones clickeables inline.
// Header copiado del surveyEmail.ts para consistencia visual.

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function firstName(name?: string | null): string {
  return (name || "").trim().split(/\s+/)[0] || "";
}

interface Args {
  storeName: string;
  logoUrl?: string | null;
  accent: string;
  customerName?: string | null;
  surveyUrl: string;
  trackOpenUrl?: string | null;
  unsubscribeUrl?: string | null;
}

const REASONS = [
  { id: "price", emoji: "💰", label: "Los precios me parecen altos" },
  { id: "quality", emoji: "😕", label: "La calidad no fue la esperada" },
  { id: "delivery_time", emoji: "🚗", label: "El delivery demora o es caro" },
  { id: "competitor", emoji: "🔄", label: "Encontré otro local" },
  { id: "no_occasion", emoji: "⏰", label: "No he tenido la ocasión" },
  { id: "other", emoji: "💬", label: "Otro motivo" },
];

export function abandonmentSurveySubject(args: Pick<Args, "customerName" | "storeName">): string {
  const name = firstName(args.customerName);
  return name ? `${name}, pasó algo? :(` : `Pasó algo? :(`;
}

export function abandonmentSurveyHtml(args: Args): string {
  const name = firstName(args.customerName);
  const accent = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(args.accent) ? args.accent : "#e63946";

  // Header logo — mismo estilo que surveyEmail.ts
  const headerLogo = args.logoUrl
    ? `<img src="${esc(args.logoUrl)}" alt="${esc(args.storeName)}" height="52" style="max-height:52px;max-width:180px;object-fit:contain;display:block;margin:0 auto;" />`
    : `<span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">${esc(args.storeName)}</span>`;

  const saludo = name ? `${esc(name)}, sucedió algo? 😟` : `Sucedió algo? 😟`;

  // Razones clickeables centradas
  const reasonButtons = REASONS.map(r => {
    const href = `${args.surveyUrl}?r=${r.id}`;
    return `<tr><td align="center" style="padding:3px 0;">
      <a href="${esc(href)}" style="display:inline-block;width:100%;max-width:340px;padding:12px 18px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fafafa;text-decoration:none;color:#333;font-size:14px;font-weight:600;text-align:center;">
        ${r.emoji}&nbsp;&nbsp;${esc(r.label)}
      </a>
    </td></tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">
<tr><td align="center" style="padding:32px 16px;">
<table width="480" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;width:100%;">
  <tr><td style="background:${accent};border-radius:12px 12px 0 0;padding:24px 28px;text-align:center;">
    ${headerLogo}
  </td></tr>
  <tr><td style="background:#ffffff;border-radius:0 0 12px 12px;padding:32px 28px;text-align:center;">
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 10px;">${saludo}</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 6px;">
      Hace tiempo que no pides en <strong>${esc(args.storeName)}</strong> y lo hacías seguido.
    </p>
    <p style="font-size:14px;color:#777;line-height:1.6;margin:0 0 22px;">
      Nos gustaría saber para mejorar y que no vuelva a pasar. Elige una opción:
    </p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      ${reasonButtons}
    </table>
    <p style="font-size:11px;color:#bbb;margin:18px 0 0;">Al hacer clic se guarda tu respuesta y puedes contarnos más si quieres.</p>
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;">
    <span style="font-size:11px;color:#aaa;">Powered by QuieroComer.cl</span>
    ${args.unsubscribeUrl ? `<br/><a href="${esc(args.unsubscribeUrl)}" style="font-size:11px;color:#bbb;text-decoration:underline;">Dejar de recibir estos correos</a>` : ""}
  </td></tr>
</table>
${args.trackOpenUrl ? `<img src="${esc(args.trackOpenUrl)}" width="1" height="1" style="display:none" alt="" />` : ""}
</td></tr></table>
</body></html>`;

  return html;
}

export function abandonmentSurveyText(args: Pick<Args, "storeName" | "customerName" | "surveyUrl">): string {
  const name = firstName(args.customerName);
  return `${name ? `${name}, p` : "P"}asó algo?\n\nHace tiempo que no pides en ${args.storeName} y lo hacías seguido. Nos gustaría saber para mejorar:\n${args.surveyUrl}`;
}
