import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { uberSettingsFor, uberProofOfDelivery, parseDelivery, uberStatusToOrder, type CourierInfo } from "@/lib/ecommerce/uberDirect";

export const runtime = "nodejs";

/**
 * Webhook de Uber Direct. Configurar la URL en el dashboard de Uber Direct:
 *   {origin}/api/ecommerce/uber/webhook
 * Recibe eventos delivery_status y courier_update. Actualiza el courier del
 * pedido y transiciona el estado (en reparto / entregado). Sin polling.
 * Firma verificada con X-Uber-Signature (HMAC-SHA256 del body con el clientSecret).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  const data = (body.data as Record<string, unknown>) || {};
  const deliveryId = String(body.delivery_id ?? data.id ?? (body.meta as { resource_id?: string })?.resource_id ?? body.resource_id ?? "");
  if (!deliveryId) return NextResponse.json({ ok: true });

  const order = await prisma.onlineOrder.findFirst({
    where: { uberDeliveryId: deliveryId },
    include: { restaurant: { select: { ecommerceConfig: true } } },
  });
  if (!order) return NextResponse.json({ ok: true }); // no es nuestro / ya borrado

  // Verificar firma con la clave de firma de webhooks del local (fallback a clientSecret).
  const creds = uberSettingsFor(order.restaurant);
  const secret = creds.signingKey || creds.clientSecret;
  const sig = req.headers.get("x-uber-signature");
  if (secret && sig) {
    const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    if (sig !== expected) { console.warn("[uber/webhook] firma inválida", deliveryId); return NextResponse.json({ ok: true }); }
  }

  const prev = (order.courier as unknown as Partial<CourierInfo>) || undefined;
  // Objeto delivery: en delivery_status viene en data; en courier_update puede venir parcial.
  const merged: CourierInfo = parseDelivery({ id: deliveryId, ...data }, prev);

  // Foto de entrega (best-effort) al entregar.
  if (merged.status === "delivered" && !merged.proofPhotoUrl) {
    merged.proofPhotoUrl = await uberProofOfDelivery(creds, deliveryId).catch(() => null);
  }

  // Transición de estado del pedido.
  const nextStatus = uberStatusToOrder(merged.status);
  const data2: Record<string, unknown> = { courier: merged as unknown as object };
  if (nextStatus && order.status !== nextStatus && order.status !== "CANCELLED") {
    const history: { status: string; ts: string }[] = Array.isArray(order.statusHistory) ? (order.statusHistory as { status: string; ts: string }[]) : [];
    history.push({ status: nextStatus, ts: new Date().toISOString() });
    data2.status = nextStatus;
    data2.statusHistory = history;
  }

  await prisma.onlineOrder.update({ where: { id: order.id }, data: data2 });
  return NextResponse.json({ ok: true });
}

// Uber valida la URL con un GET al configurarla.
export async function GET() { return NextResponse.json({ ok: true }); }
