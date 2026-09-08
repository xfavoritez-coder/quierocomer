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

  // Correo TRANSACCIONAL a propósito (sobrio y personal, no promocional): alineado a
  // la izquierda, sin imágenes ni botón tipo banner, con enlace de texto + versión en
  // texto plano. Eso reduce que Gmail lo clasifique en la pestaña "Promociones".
  const html = `
    <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#222;font-size:15px;line-height:1.6;max-width:520px;margin:0 auto;padding:24px 20px">
      <p style="margin:0 0 14px">${greeting}</p>
      <p style="margin:0 0 16px">Gracias por tu pedido en <strong>${esc(args.storeName)}</strong>. ${esc(intro)}</p>
      <p style="margin:0 0 18px"><a href="${esc(args.link)}" style="color:${accent};font-weight:700;text-decoration:underline">Dejar mi opinión</a></p>
      <p style="margin:0 0 4px;color:#888;font-size:13px">Si el enlace no funciona, cópialo en tu navegador:</p>
      <p style="margin:0 0 20px;color:#888;font-size:13px;word-break:break-all">${esc(args.link)}</p>
      <p style="margin:22px 0 0;color:#aaa;font-size:12px;border-top:1px solid #eee;padding-top:14px">${esc(args.storeName)} · vía QuieroComer</p>
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
