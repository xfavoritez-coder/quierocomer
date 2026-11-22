// Email de recuperación: encuesta de abandono con razones clickeables inline.
// Cada razón es un link que lleva a la página con la respuesta pre-seleccionada.
import { wrapRecoveryEmail, firstName, esc } from "./shared";

interface Args {
  storeName: string;
  logoUrl?: string | null;
  accent: string;
  customerName?: string | null;
  surveyUrl: string; // /encuesta-abandono/[enrollmentId]
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
  return name
    ? `${name}, tu opinión nos importa mucho 🙏`
    : `Tu opinión nos importa mucho 🙏`;
}

export function abandonmentSurveyHtml(args: Args): string {
  const name = firstName(args.customerName);
  const saludo = name ? `${esc(name)}, nos gustaría escucharte` : "Nos gustaría escucharte";

  const reasonButtons = REASONS.map(r => {
    const href = `${args.surveyUrl}?r=${r.id}`;
    return `<tr><td style="padding:4px 0;">
      <a href="${esc(href)}" style="display:block;padding:12px 16px;border-radius:10px;border:1.5px solid #e5e7eb;background:#fafafa;text-decoration:none;color:#333;font-size:14px;font-weight:600;text-align:left;">
        <span style="margin-right:8px;">${r.emoji}</span>${esc(r.label)}
      </a>
    </td></tr>`;
  }).join("");

  const bodyHtml = `
    <div style="text-align:center;font-size:36px;line-height:1;margin-bottom:14px;">💬</div>
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 8px;text-align:center;">${saludo}</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 20px;text-align:center;">
      Hace un tiempo que no pides en <strong>${esc(args.storeName)}</strong>.
      ¿Hubo algún motivo? Elige una opción, solo toma un segundo.
    </p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%">
      ${reasonButtons}
    </table>
    <p style="font-size:11px;color:#bbb;margin:16px 0 0;text-align:center;">Al hacer clic se guarda tu respuesta y puedes contarnos más si quieres.</p>`;

  return wrapRecoveryEmail({ ...args, bodyHtml });
}

export function abandonmentSurveyText(args: Args): string {
  const name = firstName(args.customerName);
  return `${name ? `${name}, n` : "N"}os gustaría saber tu opinión sobre ${args.storeName}.\n\nHace un tiempo que no nos visitas. ¿Hubo algún motivo?\n\nResponde aquí: ${args.surveyUrl}`;
}
