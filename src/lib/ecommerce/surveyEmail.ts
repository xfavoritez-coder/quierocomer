// ═══════════════════════════════════════════════════════════
//  Envío del correo de encuesta de satisfacción del ecommerce.
//  Lo usan el cron (envío automático) y el "enviar prueba" del panel.
// ═══════════════════════════════════════════════════════════
import type { SurveyConfig } from "./store-config";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

/** URL absoluta base de la tienda para enlaces en correos (sin request origin). */
export function storeAbsBase(opts: { customDomain?: string | null }): string {
  return opts.customDomain ? `https://${opts.customDomain}` : "https://quierocomer.com";
}

/** Reemplaza {nombre} (primer nombre del cliente) y {local} (nombre de la tienda). */
export function fillVars(tpl: string, vars: { nombre: string; local: string }): string {
  return tpl
    .replace(/\{nombre\}/gi, vars.nombre || "")
    .replace(/\{local\}/gi, vars.local || "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

interface SendSurveyArgs {
  to: string;
  link: string; // URL de la página para responder la encuesta
  storeName: string;
  logoUrl?: string | null;
  accent: string; // color de marca de la tienda
  customerName?: string | null;
  survey: Pick<SurveyConfig, "subject" | "intro">;
  trackOpenUrl?: string | null; // pixel de tracking de apertura (opcional)
}

/** Construye y envía el correo de encuesta vía Resend. Devuelve true si se envió. */
export async function sendSurveyEmail(args: SendSurveyArgs): Promise<boolean> {
  const firstName = (args.customerName || "").trim().split(/\s+/)[0] || "";
  const vars = { nombre: firstName, local: args.storeName };
  const subjectTpl = fillVars(args.survey.subject, vars);
  const subject = subjectTpl || (firstName ? `${firstName}, ¿cómo estuvo tu pedido?` : `¿Cómo estuvo tu pedido?`);
  const accent = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(args.accent) ? args.accent : "#e63946";

  const from = `${args.storeName} <hola@quierocomer.cl>`;
  const headerLogo = args.logoUrl
    ? `<img src="${esc(args.logoUrl)}" alt="${esc(args.storeName)}" height="52" style="max-height:52px;max-width:180px;object-fit:contain;display:block;margin:0 auto;" />`
    : `<span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.5px;">${esc(args.storeName)}</span>`;

  const saludo = firstName ? `${esc(firstName)}, ¿cómo estuvo tu pedido?` : `¿Cómo estuvo tu pedido?`;
  const cuerpo = `Tu opinión ayuda a otros a saber qué esperar de <strong>${esc(args.storeName)}</strong>.`;

  const starLabels = ['Muy mal', 'Mal', 'Regular', 'Bien', 'Excelente'];
  const starEmojis = ['😞', '😕', '😐', '🙂', '🤩'];
  const stars = [5, 4, 3, 2, 1].map(n => {
    const href = `${args.link}${args.link.includes('?') ? '&' : '?'}stars=${n}`;
    return `<tr><td align="center" style="padding:4px 0;">
      <a href="${esc(href)}" style="display:inline-block;width:100%;max-width:300px;padding:12px 16px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fafafa;text-decoration:none;color:#333;font-size:14px;text-align:center;">
        <span style="font-size:22px;letter-spacing:2px;">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>
        <span style="display:block;font-size:12px;color:#888;margin-top:3px;font-weight:600;">${starEmojis[n - 1]} ${starLabels[n - 1]}</span>
      </a>
    </td></tr>`;
  }).join('');

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
    <p style="font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:0 0 10px;">Califica tu experiencia</p>
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 6px;">${saludo}</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 22px;">${cuerpo}</p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      ${stars}
    </table>
    <p style="font-size:11px;color:#ccc;margin:14px 0 0;">Al tocar una estrella se guarda tu valoración automáticamente.</p>
  </td></tr>
  <tr><td align="center" style="padding:16px 0 0;">
    <span style="font-size:11px;color:#aaa;">Powered by QuieroComer.cl</span>
  </td></tr>
</table>
${args.trackOpenUrl ? `<img src="${esc(args.trackOpenUrl)}" width="1" height="1" style="display:none" alt="" />` : ''}
</td></tr></table>
</body></html>`;

  const text = `${firstName ? `${firstName}, ¿cómo estuvo todo?` : "¿Cómo estuvo todo?"}\n\nTu pedido en ${args.storeName} ya está entregado. Cuéntanos cómo fue:\n${args.link}`;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log(`[survey email dev] to=${args.to} link=${args.link}`);
    return true;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from, to: args.to, subject, html, text }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.error("[survey email] Resend error:", await res.json().catch(() => ({}))); return false; }
    return true;
  } catch (e) {
    console.error("[survey email] error:", e);
    return false;
  }
}
