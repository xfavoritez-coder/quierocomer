// ═══════════════════════════════════════════════════════════
//  Emisión de boleta SII (SharkPOS) a partir de una venta del POS (PosOrder).
//  Se dispara al cobrar (action:"pay"). PILOTO: solo locales con
//  sharkposEnabled=true y SIN Toteat. Idempotente por `venta-<posOrderId>`.
//  El resultado final del SII llega por /api/sharkpos/webhook.
// ═══════════════════════════════════════════════════════════
import { prisma } from "@/lib/prisma";
import { emitBoleta, sharkposConfigured, type BoletaItemInput, type SharkposCred } from "./client";
import { parseCentroPedidosConfig, effectivePaymentMethods } from "@/lib/ecommerce/config";
import { decryptSecret } from "@/lib/crypto/secret";

/** Credencial de emisión del local: su propia key (modo plataforma) o la global (piloto). */
export function restaurantSharkposCred(r: { sharkposApiKey?: string | null; sharkposTenantEnv?: string | null }): SharkposCred | undefined {
  if (r.sharkposApiKey) {
    const apiKey = decryptSecret(r.sharkposApiKey);
    if (apiKey) return { apiKey, env: r.sharkposTenantEnv === "production" ? "production" : "sandbox" };
  }
  return undefined; // sin key propia → el cliente usa la global del env
}

type RawItem = Record<string, unknown>;

/**
 * Arma las líneas de la boleta desde PosOrder.items. SharkPOS exige que
 * amount_total == suma de líneas. Si las líneas no cuadran exactamente con el
 * total cobrado (p. ej. por despacho o descuento a nivel de pedido), se consolida
 * en UNA línea por el total real, para que la boleta refleje siempre lo cobrado.
 */
export function buildLines(items: unknown, total: number, fallbackName: string, deliveryFee = 0): { lines: BoletaItemInput[]; amountTotal: number } {
  const arr: RawItem[] = Array.isArray(items) ? (items as RawItem[]) : [];
  const lines: BoletaItemInput[] = [];
  for (const it of arr) {
    const name = String(it.productName || it.dishName || it.name || "Ítem").trim() || "Ítem";
    const qty = Math.max(1, Math.round(Number(it.quantity ?? it.qty ?? 1)) || 1);
    let price = Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0);
    if (!(price > 0) && Number(it.unitTotal) > 0) price = Number(it.unitTotal) / qty;
    price = Math.round(price);
    if (price > 0) lines.push({ name, qty, price });
  }
  // El despacho es parte del total cobrado → va como su propia línea.
  if (deliveryFee > 0) lines.push({ name: "Despacho", qty: 1, price: Math.round(deliveryFee) });

  const lineSum = lines.reduce((s, l) => s + l.qty * l.price, 0);
  // SharkPOS exige amount_total == suma de líneas. Si calza, boleta detallada; si
  // no (descuento a nivel de pedido, datos raros), se consolida en una línea por el total.
  if (lines.length && lineSum === total) return { lines, amountTotal: total };
  return { lines: [{ name: fallbackName, qty: 1, price: total }], amountTotal: total };
}

export async function emitBoletaForPosOrder(posOrderId: string): Promise<void> {
  const order = await prisma.posOrder.findUnique({
    where: { id: posOrderId },
    select: {
      id: true, totalAmount: true, deliveryFee: true, items: true, customerEmail: true,
      orderReference: true, externalId: true, boletaDteId: true, rawPayload: true,
      restaurant: { select: { sharkposEnabled: true, toteatWebhookSecret: true, centroPedidosConfig: true, sharkposApiKey: true, sharkposTenantEnv: true } },
    },
  });
  if (!order) return;

  // Capa 1 — el local emite por SharkPOS.
  if (!order.restaurant?.sharkposEnabled) return;      // local no habilitado
  if (order.restaurant.toteatWebhookSecret) return;    // usa Toteat → su fiscal va por ahí
  if (order.boletaDteId) return;                       // ya tiene boleta
  // Debe haber una key usable: la del local (modo plataforma) o la global (piloto).
  const cred = restaurantSharkposCred(order.restaurant);
  if (!cred && !sharkposConfigured()) return;
  const total = order.totalAmount || 0;
  if (total <= 0) return;

  // Capa 2 — el método de pago usado emite documento fiscal.
  const methods = effectivePaymentMethods(parseCentroPedidosConfig(order.restaurant.centroPedidosConfig));
  const fiscalByKey = new Map(methods.map((m) => [m.key, m.emitsFiscal]));
  const pp = (order.rawPayload && typeof order.rawPayload === "object" && !Array.isArray(order.rawPayload))
    ? ((order.rawPayload as Record<string, unknown>).posPayment as { method?: string; parts?: { method?: string }[] } | undefined)
    : undefined;
  const usedMethods: string[] = [];
  if (pp) {
    if (Array.isArray(pp.parts)) for (const p of pp.parts) { if (p?.method) usedMethods.push(String(p.method)); }
    else if (pp.method) usedMethods.push(String(pp.method));
  }
  // Emite si al menos un método usado emite fiscal. Si no se puede determinar el
  // método, se mantiene el comportamiento por defecto (los métodos base emiten).
  const anyFiscal = usedMethods.length ? usedMethods.some((m) => fiscalByKey.get(m) !== false) : true;
  if (!anyFiscal) return;

  const ref = order.orderReference || order.externalId || order.id.slice(-6);
  const { lines, amountTotal } = buildLines(order.items, total, `Venta ${ref}`, order.deliveryFee || 0);
  const email = order.customerEmail && order.customerEmail.includes("@") ? order.customerEmail : undefined;

  try {
    // RUT recién dado de alta: SharkPOS pide folios al SII en segundo plano, así
    // que las primeras ventas pueden devolver 409 FOLIOS_EXHAUSTED. Se reintenta
    // con la MISMA idempotency-key (seguro: replay si ya se emitió) hasta que
    // haya folios. Corre dentro de after() (no bloquea el cobro).
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const FOLIO_DELAYS = [15_000, 30_000, 45_000, 60_000]; // ~2,5 min de margen
    let r = await emitBoleta({ idempotencyKey: `venta-${order.id}`, amountTotal, items: lines, receptorEmail: email }, cred);
    for (let i = 0; i < FOLIO_DELAYS.length && !r.dteId; i++) {
      const noFolios = r.httpStatus === 409 && /FOLIOS?_EXHAUSTED|folio/i.test(`${r.code || ""} ${r.message || ""}`);
      if (!noFolios) break;
      await prisma.posOrder.update({ where: { id: order.id }, data: { boletaStatus: "pendiente:folios" } }).catch(() => {});
      await sleep(FOLIO_DELAYS[i]);
      r = await emitBoleta({ idempotencyKey: `venta-${order.id}`, amountTotal, items: lines, receptorEmail: email }, cred);
    }
    if (r.dteId) {
      await prisma.posOrder.update({
        where: { id: order.id },
        data: {
          boletaDteId: r.dteId,
          boletaFolio: r.folio ?? null,
          boletaStatus: r.publicStatus || r.dteStatus || r.status || "emitida",
          boletaPdfUrl: r.pdfUrl || r.links?.pdf || null,
          boletaPublicUrl: r.publicUrl || null,
          boletaEmittedAt: new Date(),
        },
      });
    } else {
      // No se emitió (4xx): se registra para visibilidad; NO bloquea el cobro.
      await prisma.posOrder.update({ where: { id: order.id }, data: { boletaStatus: `error:${r.code || r.httpStatus}` } });
      console.error("[sharkpos] boleta no emitida", order.id, r.httpStatus, r.code, r.message);
    }
  } catch (e) {
    console.error("[sharkpos] emitBoletaForPosOrder", order.id, String(e));
  }
}
