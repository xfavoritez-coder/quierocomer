import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  preparing: "En preparación",
  ready: "Listo, esperando repartidor",
  out_for_delivery: "En camino",
  delivered: "Entregado",
};

/** GET /api/track/[token] → estado público del pedido para seguimiento del cliente. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });

  const o = await prisma.posOrder.findUnique({
    where: { trackingToken: token },
    select: {
      opsStage: true, isDelivery: true, customerName: true, addressLine: true,
      customerLat: true, customerLng: true, lastLat: true, lastLng: true,
      trackingLastPingAt: true, assignedTo: true, courier: true,
      restaurant: { select: { name: true, logoUrl: true } },
    },
  });
  if (!o) return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });

  const courier = (o.courier as any) || null;
  return NextResponse.json({
    ok: true,
    store: o.restaurant?.name || "",
    storeLogo: o.restaurant?.logoUrl || null,
    status: o.opsStage,
    statusLabel: STATUS_LABEL[o.opsStage] || o.opsStage,
    delivered: o.opsStage === "delivered",
    customerName: o.customerName || "",
    address: o.addressLine || "",
    destLat: o.customerLat ?? null,
    destLng: o.customerLng ?? null,
    // Ubicación del repartidor: propio (GPS) o courier externo.
    driverLat: o.lastLat ?? courier?.location?.lat ?? null,
    driverLng: o.lastLng ?? courier?.location?.lng ?? null,
    driverName: o.assignedTo || courier?.courierName || null,
    lastPingAt: o.trackingLastPingAt,
    courierTrackingUrl: courier?.trackingUrl || null,
  });
}
