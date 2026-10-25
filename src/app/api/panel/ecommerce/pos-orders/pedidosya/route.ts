import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pyaSettingsFor, pyaCreateShipping, pyaCancelShipping } from "@/lib/ecommerce/pedidosya";
import { chargeWallet, refundWallet } from "@/lib/ecommerce/deliveryWallet";
import { getSurchargeTiers, computeSurcharge } from "@/lib/ecommerce/deliverySurcharge";

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

/** POST → solicita envío PedidosYa para un PosOrder. Body { restaurantId, id } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { restaurant: { select: { name: true, address: true, phone: true, whatsapp: true, ecommerceConfig: true, deliveryBalance: true } } } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!order.isDelivery) return NextResponse.json({ error: "El pedido no es de delivery" }, { status: 400 });
  if (order.pyaShippingId || order.uberDeliveryId) return NextResponse.json({ error: "El pedido ya tiene un courier asignado" }, { status: 409 });
  if (!order.addressLine || !order.customerPhone) return NextResponse.json({ error: "El pedido no tiene dirección o teléfono de entrega" }, { status: 400 });

  // Billetera prepaga: requiere saldo para solicitar el repartidor externo.
  const balance = order.restaurant.deliveryBalance ?? 0;
  if (balance <= 0) return NextResponse.json({ error: "Sin saldo para delivery. Recarga tu saldo para solicitar repartidores externos." }, { status: 402 });

  // Claim atómico: evita que clics rápidos creen varios envíos PedidosYa.
  const claim = await prisma.posOrder.updateMany({
    where: { id: order.id, pyaShippingId: null, uberDeliveryId: null },
    data: { pyaShippingId: "PENDING" },
  });
  if (claim.count === 0) {
    const cur = await prisma.posOrder.findUnique({ where: { id: order.id }, select: { courier: true } });
    return NextResponse.json({ ok: true, alreadyRequested: true, courier: cur?.courier });
  }

  const creds = pyaSettingsFor(order.restaurant);
  const res = await pyaCreateShipping(creds, {
    referenceId: `pos-${order.id}`,
    totalValue: order.totalAmount,
    description: `Pedido ${order.externalId}`,
    dropoffName: order.customerName,
    dropoffPhone: order.customerPhone,
    dropoffAddress: order.addressLine,
    dropoffLat: order.customerLat,
    dropoffLng: order.customerLng,
  });
  if (!res.ok || !res.courier) {
    await prisma.posOrder.updateMany({ where: { id: order.id, pyaShippingId: "PENDING" }, data: { pyaShippingId: null } });
    return NextResponse.json({ error: res.error || "No se pudo solicitar PedidosYa" }, { status: 502 });
  }

  await prisma.posOrder.update({ where: { id: order.id }, data: { pyaShippingId: res.courier.deliveryId, courier: res.courier as unknown as object, assignedTo: "PedidosYa" } });

  // Cobra el costo real del despacho + el recargo de plataforma al saldo prepago.
  const fee = (res.courier as { fee?: number | null }).fee ?? 0;
  const surcharge = computeSurcharge(await getSurchargeTiers(), fee);
  const ref = order.orderReference || order.id.slice(-6);
  let newBalance = balance;
  if (fee > 0) {
    const charge = await chargeWallet(restaurantId, fee, { type: "charge", description: `PedidosYa · despacho pedido ${ref}`, orderId: order.id, createdBy: "pedidosya" });
    newBalance = charge.balance;
  }
  if (surcharge > 0) {
    const charge = await chargeWallet(restaurantId, surcharge, { type: "surcharge", description: `Recargo por repartidor externo · pedido ${ref}`, orderId: order.id, createdBy: "pedidosya" });
    newBalance = charge.balance;
  }
  return NextResponse.json({ ok: true, courier: res.courier, balance: newBalance, surcharge });
}

/** DELETE → cancela el envío PedidosYa. ?restaurantId=&id= */
export async function DELETE(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { restaurant: { select: { ecommerceConfig: true, name: true, address: true, phone: true, whatsapp: true } } } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!order.pyaShippingId) return NextResponse.json({ ok: true });
  if (order.pyaShippingId === "PENDING") {
    await prisma.posOrder.update({ where: { id }, data: { pyaShippingId: null, courier: undefined as any, assignedTo: null } });
    return NextResponse.json({ ok: true });
  }

  const res = await pyaCancelShipping(pyaSettingsFor(order.restaurant), order.pyaShippingId);
  if (!res.ok) return NextResponse.json({ error: res.error || "No se pudo cancelar" }, { status: 502 });
  await prisma.posOrder.update({ where: { id }, data: { pyaShippingId: null, courier: undefined as any, assignedTo: null } });

  // Reembolsa al saldo lo cobrado por este despacho (neto).
  const txns = await prisma.deliveryWalletTxn.findMany({ where: { restaurantId, orderId: id }, select: { amount: true } });
  const net = txns.reduce((s, t) => s + t.amount, 0);
  if (net < 0) await refundWallet(restaurantId, -net, { description: `Reembolso · courier cancelado pedido ${order.orderReference || id.slice(-6)}`, orderId: id, createdBy: "pedidosya" });
  return NextResponse.json({ ok: true });
}
