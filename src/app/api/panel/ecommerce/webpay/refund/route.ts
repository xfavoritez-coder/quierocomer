import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { webpayRefund, webpaySettingsFor } from "@/lib/payments/webpay";

export const runtime = "nodejs";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/**
 * POST /api/panel/ecommerce/webpay/refund  { restaurantId, orderId, amount? }
 * Reembolsa una transacción Webpay. Sin amount → reembolso total (order.total);
 * con amount < total → reembolso parcial. Útil para la certificación de Transbank.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const orderId = (body?.orderId || "").toString();
  if (!restaurantId || !orderId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    select: { id: true, restaurantId: true, total: true, webpayToken: true, paymentGateway: true, restaurant: { select: { ecommerceConfig: true } } },
  });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (order.paymentGateway !== "webpay" || !order.webpayToken) return NextResponse.json({ error: "El pedido no tiene una transacción Webpay" }, { status: 400 });

  const amount = Math.round(Number(body?.amount) || order.total);
  if (!Number.isFinite(amount) || amount <= 0 || amount > order.total) {
    return NextResponse.json({ error: "Monto de reembolso inválido" }, { status: 400 });
  }

  const res = await webpayRefund(order.webpayToken, amount, webpaySettingsFor({ ecommerceConfig: order.restaurant.ecommerceConfig }));
  if (!res.ok) return NextResponse.json({ error: res.error || "No se pudo reembolsar" }, { status: 400 });
  return NextResponse.json({ ok: true, type: res.type, amount });
}
