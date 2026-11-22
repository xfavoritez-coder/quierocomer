// Email de recuperación: primer comprador que no ha vuelto.
// Tono cálido y cercano, invita a volver sin presionar.
import { wrapRecoveryEmail, ctaButton, firstName, esc } from "./shared";

interface Args {
  storeName: string;
  logoUrl?: string | null;
  accent: string;
  customerName?: string | null;
  topProduct?: string | null;
  storeUrl: string;
  trackOpenUrl?: string | null;
  unsubscribeUrl?: string | null;
}

export function firstBuyerSubject(args: Pick<Args, "customerName" | "storeName">): string {
  const name = firstName(args.customerName);
  return name
    ? `${name}, nos encantó tenerte en ${args.storeName} 🙌`
    : `Nos encantó tenerte en ${args.storeName} 🙌`;
}

export function firstBuyerHtml(args: Args): string {
  const name = firstName(args.customerName);
  const saludo = name ? `${esc(name)}, gracias por tu primer pedido` : "Gracias por tu primer pedido";
  const productLine = args.topProduct
    ? `<p style="font-size:14px;color:#555;line-height:1.6;margin:12px 0 0;">La última vez pediste <strong>${esc(args.topProduct)}</strong>. ¿Quieres repetir o probar algo nuevo?</p>`
    : "";

  const bodyHtml = `
    <div style="text-align:center;font-size:36px;line-height:1;margin-bottom:14px;">🍽️</div>
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 10px;text-align:center;">${saludo}</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0;text-align:center;">
      Esperamos que hayas disfrutado tu experiencia en <strong>${esc(args.storeName)}</strong>.
      Tenemos muchas opciones esperándote para tu próximo antojo.
    </p>
    ${productLine}
    ${ctaButton("Ver la carta →", args.storeUrl, args.accent)}
    <p style="font-size:12px;color:#ccc;margin:20px 0 0;text-align:center;">Si el botón no funciona: <a href="${esc(args.storeUrl)}" style="color:#aaa;">${esc(args.storeUrl)}</a></p>`;

  return wrapRecoveryEmail({ ...args, bodyHtml });
}

export function firstBuyerText(args: Args): string {
  const name = firstName(args.customerName);
  return `${name ? `${name}, g` : "G"}racias por tu primer pedido en ${args.storeName}.\n\nEsperamos que lo hayas disfrutado. Tenemos muchas opciones para tu próximo antojo:\n${args.storeUrl}`;
}
