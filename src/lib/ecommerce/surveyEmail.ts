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
}

/** Construye y envía el correo de encuesta vía Resend. Devuelve true si se envió. */
export async function sendSurveyEmail(args: SendSurveyArgs): Promise<boolean> {
  const firstName = (args.customerName || "").trim().split(/\s+/)[0] || "";
  const vars = { nombre: firstName, local: args.storeName };
  const subject = fillVars(args.survey.subject, vars) || "¿Cómo estuvo tu pedido?";
  const intro = fillVars(args.survey.intro, vars) || "Nos encantaría conocer tu opinión.";
  const accent = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(args.accent) ? args.accent : "#e63946";

  const greeting = firstName ? `Hola ${esc(firstName)},` : "Hola,";

  const logoHtml = args.logoUrl
    ? `<img src="${esc(args.logoUrl)}" alt="${esc(args.storeName)}" width="52" height="52" style="width:52px;height:52px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 12px;border:2px solid #eee">`
    : "";

  const html = `
    <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;font-size:15px;line-height:1.6;max-width:480px;margin:0 auto;padding:32px 20px">
      ${logoHtml}
      <p style="margin:0 0 6px;font-size:13px;color:#888;text-align:center;letter-spacing:0.03em;text-transform:uppercase">${esc(args.storeName)}</p>
      <p style="margin:0 0 20px;font-size:22px;text-align:center">⭐</p>
      <p style="margin:0 0 8px;font-size:15px">${greeting}</p>
      <p style="margin:0 0 28px;font-size:15px;color:#333">${esc(intro)}</p>
      <div style="text-align:center;margin-bottom:28px">
        <a href="${esc(args.link)}" style="display:inline-block;padding:13px 32px;background:#fff;color:${accent};font-size:15px;font-weight:700;text-decoration:none;border-radius:999px;border:2px solid ${accent};letter-spacing:0.01em">Dejar mi opinión →</a>
      </div>
      <p style="margin:0 0 3px;color:#aaa;font-size:12px;text-align:center">Si el botón no funciona, copia este enlace:</p>
      <p style="margin:0 0 0;color:#bbb;font-size:11px;text-align:center;word-break:break-all">${esc(args.link)}</p>
      <p style="margin:28px 0 0;color:#ccc;font-size:11px;text-align:center;border-top:1px solid #f0f0f0;padding-top:16px">${esc(args.storeName)} · vía QuieroComer</p>
    </div>`;
  const text = `${firstName ? `Hola ${firstName},` : "Hola,"}\n\nGracias por tu pedido en ${args.storeName}. ${intro}\n\nDeja tu opinión aquí:\n${args.link}\n\n${args.storeName} · vía QuieroComer`;

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.log(`[survey email dev] to=${args.to} link=${args.link}`);
    return true;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || "QuieroComer <noreply@quierocomer.com>",
        to: args.to,
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) { console.error("[survey email] Resend error:", await res.json().catch(() => ({}))); return false; }
    return true;
  } catch (e) {
    console.error("[survey email] error:", e);
    return false;
  }
}
