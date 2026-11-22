// Email de recuperación: encuesta de abandono (cliente inactivo, preguntar por qué se fue).
// Tono respetuoso, sin presionar. El link lleva a la página de encuesta de abandono.
import { wrapRecoveryEmail, ctaButton, firstName, esc } from "./shared";

interface Args {
  storeName: string;
  logoUrl?: string | null;
  accent: string;
  customerName?: string | null;
  surveyUrl: string; // /encuesta-abandono/[enrollmentId]
  trackOpenUrl?: string | null;
  unsubscribeUrl?: string | null;
}

export function abandonmentSurveySubject(args: Pick<Args, "customerName" | "storeName">): string {
  const name = firstName(args.customerName);
  return name
    ? `${name}, tu opinión nos importa mucho 🙏`
    : `Tu opinión nos importa mucho 🙏`;
}

export function abandonmentSurveyHtml(args: Args): string {
  const name = firstName(args.customerName);
  const saludo = name ? `${esc(name)}, nos gustaría escucharte` : "Nos gustaría escucharte";

  const bodyHtml = `
    <div style="text-align:center;font-size:36px;line-height:1;margin-bottom:14px;">💬</div>
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 10px;text-align:center;">${saludo}</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0;text-align:center;">
      Hace un tiempo que no pides en <strong>${esc(args.storeName)}</strong> y nos gustaría saber si hubo algún motivo o simplemente no has tenido la ocasión.
    </p>
    <p style="font-size:14px;color:#777;line-height:1.6;margin:12px 0 0;text-align:center;">
      Tu respuesta nos ayuda a mejorar. Solo toma unos segundos.
    </p>
    ${ctaButton("Contarnos →", args.surveyUrl, args.accent)}
    <p style="font-size:12px;color:#ccc;margin:20px 0 0;text-align:center;">Si el botón no funciona: <a href="${esc(args.surveyUrl)}" style="color:#aaa;">${esc(args.surveyUrl)}</a></p>`;

  return wrapRecoveryEmail({ ...args, bodyHtml });
}

export function abandonmentSurveyText(args: Args): string {
  const name = firstName(args.customerName);
  return `${name ? `${name}, n` : "N"}os gustaría saber tu opinión sobre ${args.storeName}.\n\nHace un tiempo que no nos visitas y queremos saber si hubo algún motivo. Tu respuesta nos ayuda a mejorar:\n${args.surveyUrl}`;
}
