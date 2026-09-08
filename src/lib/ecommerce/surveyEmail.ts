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
  const logo = args.logoUrl
    ? `<img src="${esc(args.logoUrl)}" alt="${esc(args.storeName)}" width="56" height="56" style="width:56px;height:56px;border-radius:14px;object-fit:cover;display:block;margin:0 auto 14px" />`
    : "";

  const html = `
    <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f5f7;padding:40px 20px">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;text-align:center;border:1px solid #eee">
        ${logo}
        <p style="font-size:16px;font-weight:800;color:#111;margin:0 0 2px">${esc(args.storeName)}</p>
        <h1 style="font-size:22px;font-weight:800;color:#111;margin:18px 0 8px">${greeting}</h1>
        <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px">${esc(intro)}</p>
        <a href="${esc(args.link)}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;font-weight:800;font-size:15px;padding:14px 32px;border-radius:999px">Calificar mi pedido →</a>
        <p style="color:#aaa;font-size:12px;margin:26px 0 0">Solo te tomará unos segundos. Si el botón no funciona, copia y pega este enlace:<br><span style="color:#888;word-break:break-all">${esc(args.link)}</span></p>
      </div>
      <p style="text-align:center;color:#ccc;font-size:12px;margin-top:18px">Enviado por ${esc(args.storeName)} · vía QuieroComer.cl</p>
    </div>`;

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
