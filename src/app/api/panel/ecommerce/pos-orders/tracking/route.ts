import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodePosOrders } from "@/lib/ecommerce/geocode";
import { parseDeliveryConfig } from "@/lib/ecommerce/delivery";

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

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, address: true, lat: true, lng: true, ecommerceConfig: true, ecommerceDeliveryConfig: true },
  });

  // Ubicación del local: la configurada en Ecommerce → Delivery (origin);
  // como respaldo, el lat/lng del restaurante.
  const deliveryCfg = parseDeliveryConfig(restaurant?.ecommerceDeliveryConfig);
  const localLat = deliveryCfg.origin?.lat ?? restaurant?.lat ?? null;
  const localLng = deliveryCfg.origin?.lng ?? restaurant?.lng ?? null;
  const localAddress = deliveryCfg.originAddress ?? restaurant?.address ?? null;

  // Todos los pedidos activos (no entregados ni cancelados) para posicionarlos
  // en el mapa: en preparación, listos y en reparto.
  const orders = await prisma.posOrder.findMany({
    where: { restaurantId, opsStage: { not: "delivered" }, posStatus: { not: "canceled" } },
    orderBy: [{ opsDispatchedAt: "desc" }, { updatedAt: "desc" }],
    include: { assignedDriver: { select: { displayName: true } } },
  });

  // Un pedido con dirección pero sin monto de delivery se toma como retiro
  // (no lleva casa del cliente en el mapa).
  const isDeliveryOrder = (o: { isDelivery: boolean; deliveryFee: number }) => o.isDelivery && o.deliveryFee > 0;

  // Geocodifica (y persiste) las direcciones delivery que aún no tengan coords,
  // para que la casa del cliente aparezca en el mapa.
  const toGeo = orders.filter((o) => isDeliveryOrder(o) && o.addressLine && (o.customerLat == null || o.customerLng == null));
  const geo = toGeo.length
    ? await geocodePosOrders(restaurant, toGeo.map((o) => ({ id: o.id, addressLine: o.addressLine || "", customerLat: o.customerLat, customerLng: o.customerLng })), 8)
    : new Map<string, { lat: number; lng: number }>();

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
      isDelivery: isDeliveryOrder(o),
      createdAt: o.createdAt ? o.createdAt.toISOString() : null,
      destLat: o.customerLat ?? geo.get(o.id)?.lat ?? null,
      destLng: o.customerLng ?? geo.get(o.id)?.lng ?? null,
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

  const local = restaurant && localLat != null && localLng != null
    ? { name: restaurant.name, address: localAddress, lat: localLat, lng: localLng }
    : null;

  return NextResponse.json({ orders: items, local });
}
