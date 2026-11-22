// Email de recuperación: cliente en riesgo (frecuencia menor a la habitual).
// Tono suave, recuerda el producto favorito, sin descuento.
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

export function atRiskSubject(args: Pick<Args, "customerName" | "storeName">): string {
  const name = firstName(args.customerName);
  return name
    ? `${name}, te echamos de menos en ${args.storeName} 💛`
    : `Te echamos de menos en ${args.storeName} 💛`;
}

export function atRiskHtml(args: Args): string {
  const name = firstName(args.customerName);
  const saludo = name ? `${esc(name)}, hace tiempo que no nos vemos` : "Hace tiempo que no nos vemos";
  const productLine = args.topProduct
    ? `<p style="font-size:14px;color:#555;line-height:1.6;margin:12px 0 0;text-align:center;">Tu favorito <strong>${esc(args.topProduct)}</strong> sigue aquí esperándote.</p>`
    : "";

  const bodyHtml = `
    <div style="text-align:center;font-size:36px;line-height:1;margin-bottom:14px;">👋</div>
    <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 10px;text-align:center;">${saludo}</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0;text-align:center;">
      En <strong>${esc(args.storeName)}</strong> siempre estamos preparando algo rico para ti.
      Si estás pensando en qué comer, pasa a ver nuestro menú.
    </p>
    ${productLine}
    ${ctaButton("Ver el menú →", args.storeUrl, args.accent)}
    <p style="font-size:12px;color:#ccc;margin:20px 0 0;text-align:center;">Si el botón no funciona: <a href="${esc(args.storeUrl)}" style="color:#aaa;">${esc(args.storeUrl)}</a></p>`;

  return wrapRecoveryEmail({ ...args, bodyHtml });
}

export function atRiskText(args: Args): string {
  const name = firstName(args.customerName);
  return `${name ? `${name}, h` : "H"}ace tiempo que no nos vemos en ${args.storeName}.\n\n${args.topProduct ? `Tu favorito ${args.topProduct} sigue aquí. ` : ""}Pasa a ver nuestro menú:\n${args.storeUrl}`;
}
