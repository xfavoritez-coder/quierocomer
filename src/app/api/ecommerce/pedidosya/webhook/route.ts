import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pyaSettingsFor, pyaStatusToOps } from "@/lib/ecommerce/pedidosya";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PedidosYa valida la URL con GET. */
export async function GET() { return NextResponse.json({ ok: true }); }

/**
 * POST /api/ecommerce/pedidosya/webhook — eventos SHIPPING_STATUS de PedidosYa.
 * Auth: el `authorizationKey` configurado llega en Authorization / x-api-key.
 * Actualiza el courier del PosOrder y su etapa (out_for_delivery/delivered).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  let body: any;
  try { body = JSON.parse(raw || "null"); } catch { return NextResponse.json({ ok: true }); }
  if (!body) return NextResponse.json({ ok: true });

  const topic = (body.topic || body.data?.topic || "").toString().toUpperCase();
  if (topic && topic !== "SHIPPING_STATUS") return NextResponse.json({ ok: true });

  const data = body.data || {};
  const shippingId = String(data.id ?? body.id ?? data.shippingId ?? "");
  const referenceId = String(data.referenceId ?? body.referenceId ?? "");
  const status = String(data.data?.status ?? data.status ?? body.status ?? "");

  // Resolver el pedido por shippingId, o por referenceId (pos-<id>).
  let pos = shippingId ? await prisma.posOrder.findFirst({ where: { pyaShippingId: shippingId }, include: { restaurant: { select: { ecommerceConfig: true, name: true, address: true, phone: true, whatsapp: true } } } }) : null;
  if (!pos && referenceId.startsWith("pos-")) {
    pos = await prisma.posOrder.findUnique({ where: { id: referenceId.slice(4) }, include: { restaurant: { select: { ecommerceConfig: true, name: true, address: true, phone: true, whatsapp: true } } } });
  }
  if (!pos) return NextResponse.json({ ok: true });

  // Verificar el authorizationKey (secreto del local) — string plano, no HMAC.
  const creds = pyaSettingsFor(pos.restaurant);
  const provided = (req.headers.get("authorization") || req.headers.get("x-api-key") || req.headers.get("x-authorization-key") || "").trim();
  if (creds.webhookSecret && provided && provided !== creds.webhookSecret) {
    console.warn("[pedidosya/webhook] secreto inválido", shippingId);
    return NextResponse.json({ ok: true });
  }

  const prev = (pos.courier as any) || {};
  const courier = { ...prev, provider: "pya", deliveryId: shippingId || prev.deliveryId, status, updatedAt: new Date().toISOString() };
  if (data.trackingUrl || data.shareLocationUrl) courier.trackingUrl = data.trackingUrl || data.shareLocationUrl;
  if (data.courier?.name) courier.courierName = data.courier.name;
  if (data.courier?.phone) courier.courierPhone = data.courier.phone;

  const ops = pyaStatusToOps(status);
  const upd: any = { courier };
  if (ops === "out_for_delivery" && pos.opsStage !== "delivered") { upd.opsStage = "out_for_delivery"; upd.opsDispatchedAt = pos.opsDispatchedAt ?? new Date(); }
  else if (ops === "delivered") { upd.opsStage = "delivered"; upd.opsDeliveredAt = new Date(); }
  else if (ops === "canceled") { upd.pyaShippingId = null; }

  await prisma.posOrder.update({ where: { id: pos.id }, data: upd });
  return NextResponse.json({ ok: true });
}
