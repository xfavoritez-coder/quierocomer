import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uberSettingsFor, uberCreateDelivery, uberCancelDelivery, type CreateDeliveryParams } from "@/lib/ecommerce/uberDirect";

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

/** POST → solicita repartidor Uber Direct para un PosOrder. Body { restaurantId, id } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { restaurant: { select: { id: true, name: true, address: true, phone: true, whatsapp: true, ecommerceConfig: true } } } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!order.isDelivery) return NextResponse.json({ error: "El pedido no es de delivery" }, { status: 400 });
  if (order.uberDeliveryId) return NextResponse.json({ ok: true, alreadyRequested: true, courier: order.courier });

  const pickupPhone = order.restaurant.address ? (order.restaurant.phone || order.restaurant.whatsapp || "") : "";
  if (!order.restaurant.address || !pickupPhone) return NextResponse.json({ error: "Falta la dirección o teléfono del local (configúralos en el perfil)" }, { status: 400 });
  if (!order.addressLine || !order.customerPhone) return NextResponse.json({ error: "El pedido no tiene dirección o teléfono de entrega" }, { status: 400 });

  const items = Array.isArray(order.items) ? (order.items as any[]) : [];
  const params: CreateDeliveryParams = {
    pickupName: order.restaurant.name,
    pickupAddress: order.restaurant.address,
    pickupPhone,
    dropoffName: order.customerName,
    dropoffAddress: order.addressLine,
    dropoffPhone: order.customerPhone,
    dropoffLat: order.customerLat,
    dropoffLng: order.customerLng,
    manifestItems: items.map((it) => ({ name: (it?.productName || it?.name || "Producto").toString(), quantity: Math.max(1, Number(it?.quantity) || 1) })).slice(0, 30),
    manifestTotalValue: order.totalAmount,
    externalId: order.id,
  };

  const res = await uberCreateDelivery(uberSettingsFor(order.restaurant), params);
  if (!res.ok || !res.delivery) return NextResponse.json({ error: res.error || "No se pudo solicitar el repartidor" }, { status: 502 });

  await prisma.posOrder.update({ where: { id: order.id }, data: { uberDeliveryId: res.delivery.deliveryId, courier: res.delivery as unknown as object, assignedTo: "Uber Direct" } });
  return NextResponse.json({ ok: true, courier: res.delivery });
}

/** DELETE → cancela el courier Uber. ?restaurantId=&id= */
export async function DELETE(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { restaurant: { select: { ecommerceConfig: true } } } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!order.uberDeliveryId) return NextResponse.json({ ok: true });

  const res = await uberCancelDelivery(uberSettingsFor(order.restaurant), order.uberDeliveryId);
  if (!res.ok) return NextResponse.json({ error: res.error || "No se pudo cancelar" }, { status: 502 });
  await prisma.posOrder.update({ where: { id }, data: { uberDeliveryId: null, courier: undefined as any, assignedTo: null } });
  return NextResponse.json({ ok: true });
}
