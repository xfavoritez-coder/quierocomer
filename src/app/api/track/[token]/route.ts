import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { localNameFromVendor } from "@/lib/ecommerce/twilio";

interface Line { name: string; qty: number }
function normalizeItems(raw: unknown): Line[] {
  if (!Array.isArray(raw)) return [];
  const out: Line[] = [];
  for (const ln of raw) {
    if (!ln || typeof ln !== "object") continue;
    const o = ln as Record<string, any>;
    const name = String(o.productName ?? o.name ?? o.dishName ?? "").trim();
    if (!name) continue;
    const qty = Number(o.quantity ?? o.qty ?? 1) || 1;
    if (o.isExtra) continue; // los modificadores no se listan como ítem aparte
    out.push({ name, qty });
  }
  return out;
}

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
      opsStage: true, isDelivery: true, saleType: true, tableLabel: true,
      customerName: true, addressLine: true, orderReference: true, vendorName: true,
      items: true, totalAmount: true, deliveryFee: true, tipAmount: true, discountAmount: true,
      createdAt: true, opsDeliveredAt: true,
      customerLat: true, customerLng: true, lastLat: true, lastLng: true,
      trackingLastPingAt: true, assignedTo: true, courier: true,
      restaurant: { select: { name: true, logoUrl: true } },
    },
  });
  if (!o) return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });

  const courier = (o.courier as any) || null;
  const delivered = o.opsStage === "delivered";

  // Ubicación del repartidor: propio (GPS) o courier externo. Se descarta [0,0]
  // (coordenada inválida que Uber a veces envía al cerrar la entrega).
  let driverLat = o.lastLat ?? courier?.location?.lat ?? null;
  let driverLng = o.lastLng ?? courier?.location?.lng ?? null;
  if (driverLat != null && driverLng != null && Math.abs(driverLat) < 0.5 && Math.abs(driverLng) < 0.5) {
    driverLat = null; driverLng = null;
  }
  // Entregado: el repartidor se ubica en la dirección donde entregó.
  if (delivered && o.customerLat != null && o.customerLng != null) {
    driverLat = o.customerLat; driverLng = o.customerLng;
  }

  // El cliente ve la MARCA del pedido (una cuenta puede recibir de varias marcas),
  // nunca el nombre del local técnico.
  const store = localNameFromVendor(o.vendorName, o.restaurant?.name || "");
  return NextResponse.json({
    ok: true,
    store,
    storeLogo: o.restaurant?.logoUrl || null,
    status: o.opsStage,
    statusLabel: STATUS_LABEL[o.opsStage] || o.opsStage,
    delivered,
    isDelivery: o.isDelivery,
    orderType: o.isDelivery ? "delivery" : (o.tableLabel || o.saleType === "dine-in" ? "dine-in" : "pickup"),
    orderReference: o.orderReference || null,
    customerName: o.customerName || "",
    address: o.addressLine || "",
    items: normalizeItems(o.items),
    total: o.totalAmount || 0,
    deliveryFee: o.deliveryFee || 0,
    tip: o.tipAmount || 0,
    discount: o.discountAmount || 0,
    createdAt: o.createdAt ? o.createdAt.toISOString() : null,
    deliveredAt: o.opsDeliveredAt ? o.opsDeliveredAt.toISOString() : null,
    destLat: o.customerLat ?? null,
    destLng: o.customerLng ?? null,
    driverLat,
    driverLng,
    driverName: o.assignedTo || courier?.courierName || null,
    lastPingAt: o.trackingLastPingAt,
    courierTrackingUrl: courier?.trackingUrl || null,
    // PIN que el cliente le da al repartidor de Uber (respaldo de verificación).
    courierPin: courier?.dropoffPin || null,
    // Foto de prueba de entrega (data URI), cuando el courier la entregó.
    proofPhotoUrl: delivered ? (courier?.proofPhotoUrl || null) : null,
  });
}
