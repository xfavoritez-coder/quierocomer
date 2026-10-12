import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpayConfirm, webpaySettingsFor } from "@/lib/payments/webpay";
import type { Prisma } from "@prisma/client";
import { dispatchOrderToPos } from "@/lib/ecommerce/pos";
import { mirrorOnlineOrderToCentro } from "@/lib/ecommerce/centroMirror";
import { registerCouponUse } from "@/lib/ecommerce/couponUse";
import { sendOrderStatusEmail } from "@/lib/ecommerce/orderEmails";
import { notifyNewEcommerceOrder } from "@/lib/ecommerce/notifyOrder";
import { parseStoreConfig, storeBasePath } from "@/lib/ecommerce/store-config";

export const runtime = "nodejs";

/**
 * Retorno de Webpay (Transbank redirige aquí por POST tras el pago).
 *  - token_ws presente → confirmamos (commit) y marcamos la orden pagada/fallida.
 *  - TBK_TOKEN sin token_ws → el usuario canceló/abandonó el pago.
 */
// Agrega una entrada de diagnóstico al historial del pedido (no afecta el stepper,
// que solo lee entradas con `status` conocido). Sirve para revisar por pedido el
// motivo real del "Pago fallido".
function withPaymentLog(statusHistory: unknown, entry: Record<string, unknown>): Prisma.InputJsonValue {
  const hist = Array.isArray(statusHistory) ? (statusHistory as unknown[]) : [];
  return [...hist, { status: "PAYMENT_LOG", ts: new Date().toISOString(), ...entry }] as unknown as Prisma.InputJsonValue;
}
const secsSince = (d?: Date | null) => (d ? Math.round((Date.now() - d.getTime()) / 1000) : null);

async function handle(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;

  let tokenWs: string | null = null;
  let tbkToken: string | null = null;
  let tbkOrden: string | null = null;
  let tbkSesion: string | null = null;
  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    tokenWs = (form?.get("token_ws") as string) || null;
    tbkToken = (form?.get("TBK_TOKEN") as string) || null;
    tbkOrden = (form?.get("TBK_ORDEN_COMPRA") as string) || null;
    tbkSesion = (form?.get("TBK_ID_SESION") as string) || null;
  } else {
    tokenWs = req.nextUrl.searchParams.get("token_ws");
    tbkToken = req.nextUrl.searchParams.get("TBK_TOKEN");
    tbkOrden = req.nextUrl.searchParams.get("TBK_ORDEN_COMPRA");
    tbkSesion = req.nextUrl.searchParams.get("TBK_ID_SESION");
  }

  // base = "" en dominio propio (haruna.cl/checkout) o /ecommerce/<slug> en el principal.
  const checkoutFor = (base: string, q: string) => `${baseUrl}${base}/checkout?${q}`;

  // Pago cancelado/abortado por el usuario → fallido, volver al checkout a reintentar.
  // Transbank devuelve TBK_TOKEN sin token_ws cuando el cliente pulsa "Anular" o se
  // agota el tiempo del formulario (~10 min). NO es una falla de la pasarela.
  if (tbkToken && !tokenWs) {
    const order = await prisma.onlineOrder.findFirst({ where: { webpayToken: tbkToken }, select: { id: true, total: true, createdAt: true, webpayBuyOrder: true, statusHistory: true, restaurant: { select: { slug: true, ecommerceStoreConfig: true } } } });
    const secs = secsSince(order?.createdAt);
    console.warn("[webpay-return] user_aborted", JSON.stringify({
      orderId: order?.id, buyOrder: order?.webpayBuyOrder, amount: order?.total,
      secondsOnForm: secs, tbkOrdenCompra: tbkOrden, tbkIdSesion: tbkSesion,
      note: "TBK_TOKEN sin token_ws → el cliente canceló o se agotó el tiempo (abandono, no falla de la pasarela)",
    }));
    if (order) await prisma.onlineOrder.update({
      where: { id: order.id },
      data: { paymentStatus: "failed", statusHistory: withPaymentLog(order.statusHistory, { category: "user_aborted", reason: "Cancelado por el cliente o tiempo agotado en el formulario de Webpay", secondsOnForm: secs }) },
    });
    const base = order ? storeBasePath({ host: req.nextUrl.host, slug: order.restaurant.slug, customDomain: parseStoreConfig(order.restaurant.ecommerceStoreConfig).customDomain }) : "";
    return NextResponse.redirect(order ? checkoutFor(base, "pago=fallido") : `${baseUrl}/?pago=cancelado`, 303);
  }

  if (!tokenWs) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);

  const order = await prisma.onlineOrder.findFirst({ where: { webpayToken: tokenWs }, include: { restaurant: { select: { slug: true, ecommerceConfig: true, ecommerceStoreConfig: true } } } });
  if (!order) return NextResponse.redirect(`${baseUrl}/?pago=error`, 303);
  const base = storeBasePath({ host: req.nextUrl.host, slug: order.restaurant.slug, customDomain: parseStoreConfig(order.restaurant.ecommerceStoreConfig).customDomain });

  // Si ya se confirmó antes, redirigir según su estado (idempotente)
  if (order.paymentStatus === "paid") {
    return NextResponse.redirect(checkoutFor(base, `pago=exito&order=${order.id}`), 303);
  }

  const result = await webpayConfirm(tokenWs, webpaySettingsFor({ ecommerceConfig: order.restaurant.ecommerceConfig }));
  const secsOnForm = secsSince(order.createdAt);

  if (result.ok && result.authorized) {
    console.log("[webpay-return] approved", JSON.stringify({ orderId: order.id, buyOrder: order.webpayBuyOrder, amount: result.amount, secondsOnForm: secsOnForm }));
    await prisma.onlineOrder.update({
      where: { id: order.id },
      data: { paymentStatus: "paid", paidAt: new Date(), status: "ACCEPTED" },
    });
    await registerCouponUse(order);
    void sendOrderStatusEmail(order.id, "ACCEPTED");
    // Pago confirmado → enviar el pedido al POS (Toteat) si está configurado.
    // Programado: queda pagado pero NO se despacha; el cron lo libera a su hora.
    if (!order.scheduledFor || order.scheduledReleasedAt) {
      await dispatchOrderToPos(order.id, { channel: "web" }).catch((e) => console.error("[ecommerce/webpay/return] POS:", e));
      void mirrorOnlineOrderToCentro(order.id, "web").catch(() => {});
      if (order.source === "ecommerce") notifyNewEcommerceOrder({ id: order.id, restaurantId: order.restaurantId, customerName: order.customerName, total: order.total, orderType: order.orderType }).catch(() => {});
    }
    return NextResponse.redirect(checkoutFor(base, `pago=exito&order=${order.id}`), 303);
  }

  // Falló: puede ser rechazo real del banco (commit ok pero no autorizado, con
  // response_code negativo) o un error al confirmar con Transbank (commit lanzó).
  const category = result.ok ? "rejected_by_bank" : "commit_error";
  const reason = result.ok ? (result.reason || "Rechazado") : (result.error || "Error al confirmar con Webpay");
  console.warn("[webpay-return] failed", JSON.stringify({
    orderId: order.id, buyOrder: order.webpayBuyOrder, amount: order.total,
    category, reason, responseCode: result.responseCode, status: result.status,
    secondsOnForm: secsOnForm,
  }));
  await prisma.onlineOrder.update({
    where: { id: order.id },
    data: { paymentStatus: "failed", statusHistory: withPaymentLog(order.statusHistory, { category, reason, responseCode: result.responseCode ?? null, trStatus: result.status ?? null, secondsOnForm: secsOnForm }) },
  });
  return NextResponse.redirect(checkoutFor(base, "pago=fallido"), 303);
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
