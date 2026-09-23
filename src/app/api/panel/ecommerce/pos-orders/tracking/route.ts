import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/** GET /api/panel/ecommerce/pos-orders/tracking?restaurantId=X
 *  Repartos activos (en reparto) con ubicación del repartidor para el mapa en vivo. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const origin = req.nextUrl.origin;

  const orders = await prisma.posOrder.findMany({
    where: { restaurantId, opsStage: "out_for_delivery", posStatus: { not: "canceled" } },
    orderBy: [{ opsDispatchedAt: "desc" }, { updatedAt: "desc" }],
    include: { assignedDriver: { select: { displayName: true } } },
  });

  const items = orders.map((o) => {
    const courier = o.courier as { status?: string; trackingUrl?: string } | null;
    const courierName = o.uberDeliveryId ? "Uber Direct" : o.pyaShippingId ? "PedidosYa" : null;
    return {
      id: o.id,
      orderReference: o.orderReference,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      addressLine: o.addressLine,
      totalAmount: o.totalAmount,
      opsStage: o.opsStage,
      destLat: o.customerLat,
      destLng: o.customerLng,
      driverName: o.assignedDriver?.displayName || o.assignedTo || null,
      driverLat: o.lastLat,
      driverLng: o.lastLng,
      lastPingAt: o.trackingLastPingAt ? o.trackingLastPingAt.toISOString() : null,
      dispatchedAt: o.opsDispatchedAt ? o.opsDispatchedAt.toISOString() : null,
      trackingUrl: o.trackingToken ? `${origin}/track/${o.trackingToken}` : null,
      courierName,
      courierStatus: courier?.status || null,
      courierTrackingUrl: courier?.trackingUrl || null,
    };
  });

  return NextResponse.json({ orders: items });
}
