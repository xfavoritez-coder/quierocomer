// Email de recuperación: incentivo con descuento personalizado según la razón
// que el cliente dio en la encuesta de abandono.
import { wrapRecoveryEmail, ctaButton, firstName, esc } from "./shared";

interface Args {
  storeName: string;
  logoUrl?: string | null;
  accent: string;
  customerName?: string | null;
  surveyReason?: string | null;
  couponCode: string;
  couponPercent: number;
  storeUrl: string;
  trackOpenUrl?: string | null;
  unsubscribeUrl?: string | null;
}

// Mensaje personalizado según lo que respondió en la encuesta
function personalMessage(reason: string | null | undefined, storeName: string): { title: string; body: string } {
  switch (reason) {
    case "price":
      return {
        title: "Sabemos que los precios importan",
        body: `Por eso te preparamos un descuento especial. Queremos que puedas seguir disfrutando de <strong>${esc(storeName)}</strong> sin preocuparte por el precio.`,
      };
    case "quality":
      return {
        title: "Hemos estado mejorando",
        body: `Tu opinión nos importó mucho. Hemos trabajado para mejorar y nos encantaría que nos dieras otra oportunidad en <strong>${esc(storeName)}</strong>.`,
      };
    case "delivery_time": // legacy
    case "delivery_slow":
      return {
        title: "Mejoramos nuestros tiempos de entrega",
        body: `Escuchamos tu feedback. Hemos trabajado para que tu pedido llegue más rápido. Prueba la diferencia en <strong>${esc(storeName)}</strong>.`,
      };
    case "delivery_expensive":
      return {
        title: "Sabemos que el delivery importa",
        body: `Entendemos que el costo de envío pesa. Con este descuento lo compensamos para que vuelvas a disfrutar de <strong>${esc(storeName)}</strong> sin que el delivery sea un problema.`,
      };
    case "competitor":
      return {
        title: "Te echamos de menos",
        body: `Entendemos que probaste otras opciones, pero en <strong>${esc(storeName)}</strong> queremos darte una razón para volver. Este descuento es para ti.`,
      };
    case "no_occasion":
      return {
        title: "Este es el momento perfecto",
        body: `Sabemos que a veces no se da la ocasión, así que te la estamos creando. Un descuento especial para que vuelvas a pedir en <strong>${esc(storeName)}</strong>.`,
      };
    default:
      return {
        title: "Te preparamos algo especial",
        body: `Nos encantaría que volvieras a disfrutar de <strong>${esc(storeName)}</strong>. Tenemos un descuento especial para tu próximo pedido.`,
      };
  }
}

export function recoveryIncentiveSubject(args: Pick<Args, "customerName" | "storeName" | "couponPercent">): string {
  return `¿Nos das otra oportunidad? 💚 REGALO: -${args.couponPercent}% OFF`;
}

export function recoveryIncentiveHtml(args: Args): string {
  const name = firstName(args.customerName);
  const urlWithCoupon = `${args.storeUrl}${args.storeUrl.includes("?") ? "&" : "?"}coupon=${encodeURIComponent(args.couponCode)}`;
  const msg = personalMessage(args.surveyReason, args.storeName);
  const saludo = name ? `${esc(name)}, ${msg.title.toLowerCase()}` : msg.title;

  const bodyHtml = `
    <div style="text-align:center;font-size:36px;line-height:1;margin-bottom:14px;">🎁</div>
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 8px;text-align:center;">${saludo}</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0;text-align:center;">
      ${msg.body}
    </p>
    <div style="margin:24px auto;max-width:260px;text-align:center;padding:18px 24px;border:2px dashed ${args.accent};border-radius:14px;background:#fafafa;">
      <div style="font-size:28px;font-weight:900;color:${args.accent};letter-spacing:1px;">${args.couponPercent}% OFF</div>
      <div style="margin-top:8px;font-family:monospace;font-size:20px;font-weight:800;color:#111;letter-spacing:2px;background:#f0f0f0;border-radius:8px;padding:6px 14px;display:inline-block;">${esc(args.couponCode)}</div>
    </div>
    ${ctaButton("Usar mi descuento →", urlWithCoupon, args.accent)}
    <p style="font-size:12px;color:#999;margin:16px 0 0;text-align:center;">El código se aplica automáticamente al hacer clic en el botón.</p>
    <p style="font-size:12px;color:#ccc;margin:8px 0 0;text-align:center;">Si el botón no funciona: <a href="${esc(urlWithCoupon)}" style="color:#aaa;">${esc(urlWithCoupon)}</a></p>`;

  return wrapRecoveryEmail({ ...args, bodyHtml });
}

export function recoveryIncentiveText(args: Args): string {
  const name = firstName(args.customerName);
  return `${name ? `${name}, t` : "T"}enemos un ${args.couponPercent}% de descuento para tu próximo pedido en ${args.storeName}.\n\nCódigo: ${args.couponCode}\n\nUsalo aquí: ${args.storeUrl}?coupon=${args.couponCode}`;
}
