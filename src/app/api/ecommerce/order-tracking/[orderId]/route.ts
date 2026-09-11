import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deliveryHandrollVendor, fetchDhTracking, mapDhStatus, dhCourier } from "@/lib/ecommerce/deliverySync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIVE = new Set(["PENDING", "ACCEPTED", "PREPARING", "READY", "IN_DELIVERY"]);

/**
 * GET /api/ecommerce/order-tracking/[orderId]
 * Estado + ubicación en vivo del repartidor desde deliveryhandroll (solo locales
 * habilitados). La página de seguimiento le hace polling. Sincroniza el estado a la BD.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderNumber: true, toteatOrderId: true, status: true, statusHistory: true,
      orderType: true, deliveryLat: true, deliveryLng: true, courier: true, restaurantId: true,
      restaurant: { select: { ecommerceConfig: true } },
    },
  });
  if (!order) return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });

  const vendor = deliveryHandrollVendor(order.restaurant.ecommerceConfig);
  const customer = order.deliveryLat != null && order.deliveryLng != null ? { lat: order.deliveryLat, lng: order.deliveryLng } : null;

  // Sin integración, o pedido que no es delivery, o ya terminado → nada que sincronizar.
  if (!vendor || order.orderType !== "DELIVERY" || !ACTIVE.has(order.status)) {
    return NextResponse.json({ ok: true, enabled: !!vendor, status: order.status, courier: null, customer, live: false });
  }

  const track = await fetchDhTracking({ vendorName: vendor, orderNumber: order.orderNumber, toteatOrderId: order.toteatOrderId });
  const newStatus = mapDhStatus(track);
  const courier = dhCourier(track);
  const custFromDh = track && track.customer_lat != null && track.customer_lng != null ? { lat: Number(track.customer_lat), lng: Number(track.customer_lng) } : null;

  // Persistir cambio de estado + ubicación del repartidor (best-effort).
  let status = order.status;
  if (newStatus && newStatus !== order.status && order.status !== "CANCELLED") {
    status = newStatus;
    const hist = Array.isArray(order.statusHistory) ? (order.statusHistory as { status: string; ts: string }[]) : [];
    const last = hist[hist.length - 1]?.status;
    const nextHist = last === newStatus ? hist : [...hist, { status: newStatus, ts: new Date().toISOString() }];
    await prisma.onlineOrder.update({ where: { id: order.id }, data: { status: newStatus, statusHistory: nextHist } }).catch(() => {});
  }
  if (courier && (courier.lat != null || courier.name)) {
    const prev = (order.courier && typeof order.courier === "object" ? order.courier : {}) as Record<string, unknown>;
    await prisma.onlineOrder.update({
      where: { id: order.id },
      data: { courier: { ...prev, lat: courier.lat, lng: courier.lng, name: courier.name, label: courier.label, updatedAt: new Date().toISOString() } },
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    enabled: true,
    status,
    courier: courier ? { lat: courier.lat, lng: courier.lng, name: courier.name, label: courier.label } : null,
    customer: custFromDh || customer,
    live: true,
  });
}
