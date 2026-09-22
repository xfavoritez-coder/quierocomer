import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractOrders, mapToteatOrder } from "@/lib/ecommerce/posOrders";
import { notifyNewPosOrder } from "@/lib/ecommerce/notifyPosOrder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → sonda de salud (Toteat/valida la URL con GET). */
export async function GET() {
  return new NextResponse("Webhook de pedidos activo (usa POST)\n", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

/**
 * POST /api/ecommerce/toteat/webhook
 * Recibe los pedidos de Toteat de UN local, identificado por su token:
 *   - Header `x-webhook-token: <token>`  (preferido), o
 *   - Query `?token=<token>`             (fallback si Toteat no permite headers).
 * Hace upsert por (restaurantId, externalId) en PosOrder. Sin polling.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();

  const token = (req.headers.get("x-webhook-token") || req.nextUrl.searchParams.get("token") || "").trim();
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const restaurant = await prisma.restaurant.findFirst({
    where: { toteatWebhookSecret: token },
    select: { id: true },
  });
  if (!restaurant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const restaurantId = restaurant.id;

  let payload: unknown;
  try { payload = JSON.parse(raw || "null"); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const orders = extractOrders(payload);
  if (!orders.length) return NextResponse.json({ ok: true, processed: 0 });

  let processed = 0;
  const nuevos: { id: string; customerName: string; total: number; isDelivery: boolean }[] = [];

  for (const ord of orders) {
    const m = mapToteatOrder(ord);
    if (!m) continue;

    const data = {
      posStatus: m.posStatus,
      saleType: m.saleType,
      isDelivery: m.isDelivery,
      tableLabel: m.tableLabel,
      customerName: m.customerName,
      customerPhone: m.customerPhone,
      addressLine: m.addressLine,
      totalAmount: m.totalAmount,
      paidAmount: m.paidAmount,
      tipAmount: m.tipAmount,
      changeAmount: m.changeAmount,
      deliveryFee: m.deliveryFee,
      discountAmount: m.discountAmount,
      currency: m.currency,
      vendorName: m.vendorName,
      orderReference: m.orderReference,
      items: m.items ?? undefined,
      rawPayload: ord as any,
      completedAt: m.completedAt,
    };

    // ¿Ya existe? → así avisamos por push solo en los nuevos.
    const existing = await prisma.posOrder.findUnique({
      where: { restaurantId_externalId: { restaurantId, externalId: m.externalId } },
      select: { id: true },
    });

    if (existing) {
      // No tocamos opsStage/opsDeliveredAt: son del flujo del local.
      await prisma.posOrder.update({ where: { id: existing.id }, data });
    } else {
      const created = await prisma.posOrder.create({
        data: { restaurantId, externalId: m.externalId, provider: "toteat", ...data },
        select: { id: true },
      });
      nuevos.push({ id: created.id, customerName: m.customerName, total: m.totalAmount, isDelivery: m.isDelivery });
    }
    processed++;
  }

  // Aviso push (con el panel cerrado). En pantalla, Supabase Realtime ya refresca.
  for (const n of nuevos) {
    void notifyNewPosOrder({ restaurantId, id: n.id, customerName: n.customerName, total: n.total, isDelivery: n.isDelivery }).catch(() => {});
  }

  return NextResponse.json({ ok: true, processed, created: nuevos.length });
}
