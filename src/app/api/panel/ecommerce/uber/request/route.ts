import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uberSettingsFor, uberCreateDelivery, type CreateDeliveryParams } from "@/lib/ecommerce/uberDirect";

export const runtime = "nodejs";

async function verifyAccess(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

interface StoredItem { name?: string; dishName?: string; quantity?: number }

/**
 * POST /api/panel/ecommerce/uber/request { orderId }
 * Solicita un repartidor de Uber Direct para un pedido de delivery. Guarda el
 * uberDeliveryId y la info del courier; el resto de actualizaciones llegan por
 * webhook. Idempotente: si ya se solicitó, devuelve la entrega existente.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const orderId = body?.orderId as string | undefined;
  if (!orderId) return NextResponse.json({ error: "orderId requerido" }, { status: 400 });

  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    include: { restaurant: { select: { id: true, name: true, address: true, phone: true, whatsapp: true, ecommerceConfig: true } } },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!(await verifyAccess(req, order.restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (order.orderType !== "DELIVERY") return NextResponse.json({ error: "El pedido no es de delivery" }, { status: 400 });
  if (order.uberDeliveryId) return NextResponse.json({ ok: true, alreadyRequested: true, courier: order.courier });

  const creds = uberSettingsFor(order.restaurant);
  const pickupPhone = order.restaurant.phone || order.restaurant.whatsapp || "";
  if (!order.restaurant.address || !pickupPhone) {
    return NextResponse.json({ error: "Falta la dirección o teléfono del local (configúralos en el perfil)" }, { status: 400 });
  }
  if (!order.deliveryAddress || !order.customerPhone) {
    return NextResponse.json({ error: "El pedido no tiene dirección o teléfono de entrega" }, { status: 400 });
  }

  const items = (order.items as unknown as StoredItem[]) ?? [];
  const params: CreateDeliveryParams = {
    pickupName: order.restaurant.name,
    pickupAddress: order.restaurant.address,
    pickupPhone,
    dropoffName: order.customerName,
    dropoffAddress: order.deliveryAddress,
    dropoffPhone: order.customerPhone,
    dropoffLat: order.deliveryLat,
    dropoffLng: order.deliveryLng,
    dropoffNotes: order.notes,
    manifestItems: items.map((it) => ({ name: it.dishName || it.name || "Producto", quantity: Math.max(1, Number(it.quantity) || 1) })),
    manifestTotalValue: order.total,
    externalId: order.id,
  };

  const res = await uberCreateDelivery(creds, params);
  if (!res.ok || !res.delivery) return NextResponse.json({ error: res.error || "No se pudo solicitar el repartidor" }, { status: 502 });

  await prisma.onlineOrder.update({
    where: { id: order.id },
    data: { uberDeliveryId: res.delivery.deliveryId, courier: res.delivery as unknown as object },
  });

  return NextResponse.json({ ok: true, courier: res.delivery });
}
