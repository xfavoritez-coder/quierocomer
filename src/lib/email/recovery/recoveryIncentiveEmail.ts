// Email de recuperación: incentivo con descuento (último intento para clientes inactivos).
// Muestra el cupón de forma prominente con código visible.
import { wrapRecoveryEmail, ctaButton, firstName, esc } from "./shared";

interface Args {
  storeName: string;
  logoUrl?: string | null;
  accent: string;
  customerName?: string | null;
  topProduct?: string | null;
  topProductImageUrl?: string | null;
  couponCode: string;
  couponPercent: number;
  storeUrl: string;
  trackOpenUrl?: string | null;
  unsubscribeUrl?: string | null;
}

export function recoveryIncentiveSubject(args: Pick<Args, "customerName" | "storeName" | "couponPercent">): string {
  const name = firstName(args.customerName);
  return name
    ? `${name}, tenemos un ${args.couponPercent}% para ti en ${args.storeName} 🎁`
    : `Tenemos un ${args.couponPercent}% para ti en ${args.storeName} 🎁`;
}

export function recoveryIncentiveHtml(args: Args): string {
  const name = firstName(args.customerName);
  const saludo = name ? `${esc(name)}, te preparamos algo especial` : "Te preparamos algo especial";
  const urlWithCoupon = `${args.storeUrl}${args.storeUrl.includes("?") ? "&" : "?"}coupon=${encodeURIComponent(args.couponCode)}`;
  const productImage = args.topProductImageUrl
    ? `<div style="margin:0 0 16px;text-align:center;">
        <img src="${esc(args.topProductImageUrl)}" alt="${esc(args.topProduct || "")}" width="280" style="width:280px;height:auto;border-radius:14px;display:block;margin:0 auto;" />
      </div>`
    : "";
  const productLine = args.topProduct
    ? `<p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 4px;text-align:center;">¿Qué tal un <strong>${esc(args.topProduct)}</strong> con descuento?</p>`
    : "";

  const bodyHtml = `
    ${productImage}
    ${productLine}
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 8px;text-align:center;">${saludo}</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0;text-align:center;">
      Nos encantaría que volvieras a disfrutar de <strong>${esc(args.storeName)}</strong>.
      Tenemos un descuento especial para tu próximo pedido.
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
