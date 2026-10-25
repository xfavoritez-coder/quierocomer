import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uberSettingsFor, uberCreateDelivery, uberCancelDelivery, uberCreateQuote, uberQuoteErrorEs, type CreateDeliveryParams } from "@/lib/ecommerce/uberDirect";
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

/** GET → cotiza (sin crear) el despacho Uber de un PosOrder. ?restaurantId=&id=
 *  Devuelve { ok, fee, durationMin, quoteId } para mostrar el precio antes de solicitar. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { restaurant: { select: { id: true, address: true, lat: true, lng: true, ecommerceConfig: true, deliveryBalance: true } } } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!order.isDelivery) return NextResponse.json({ error: "El pedido no es de delivery" }, { status: 400 });
  if (!order.restaurant.address) return NextResponse.json({ error: "Falta la dirección del local (configúrala en el perfil)" }, { status: 400 });
  if (!order.addressLine) return NextResponse.json({ error: "El pedido no tiene dirección de entrega" }, { status: 400 });

  const res = await uberCreateQuote(uberSettingsFor(order.restaurant), {
    pickupAddress: order.restaurant.address,
    pickupLat: order.restaurant.lat,
    pickupLng: order.restaurant.lng,
    dropoffAddress: order.addressLine,
    dropoffLat: order.customerLat,
    dropoffLng: order.customerLng,
  });
  if (!res.ok) return NextResponse.json({ error: uberQuoteErrorEs(res.error) }, { status: 502 });
  const balance = order.restaurant.deliveryBalance ?? 0;
  const surcharge = computeSurcharge(await getSurchargeTiers(), res.fee ?? 0); // recargo plataforma
  const total = (res.fee ?? 0) + surcharge;
  return NextResponse.json({ ok: true, fee: res.fee, surcharge, total, durationMin: res.durationMin ?? null, quoteId: res.quoteId ?? null, balance, sufficient: res.fee == null || balance >= total });
}

/** POST → solicita repartidor Uber Direct para un PosOrder. Body { restaurantId, id, quoteId? } */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  const quoteId = (body?.quoteId || "").toString() || null;
  const expectedFee = Math.max(0, Math.round(Number(body?.fee) || 0)); // costo cotizado que vio el local
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findUnique({ where: { id }, include: { restaurant: { select: { id: true, name: true, address: true, phone: true, whatsapp: true, lat: true, lng: true, ecommerceConfig: true, deliveryBalance: true } } } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  if (!order.isDelivery) return NextResponse.json({ error: "El pedido no es de delivery" }, { status: 400 });
  if (order.uberDeliveryId) return NextResponse.json({ ok: true, alreadyRequested: true, courier: order.courier });
  if (order.pyaShippingId) return NextResponse.json({ error: "Este pedido ya tiene PedidosYa" }, { status: 409 });

  // Billetera prepaga: debe haber saldo suficiente para cubrir el despacho + el recargo.
  const tiers = await getSurchargeTiers();
  const balance = order.restaurant.deliveryBalance ?? 0;
  const expectedTotal = expectedFee > 0 ? expectedFee + computeSurcharge(tiers, expectedFee) : 0;
  if (balance <= 0) return NextResponse.json({ error: "Sin saldo para delivery. Recarga tu saldo para solicitar repartidores externos." }, { status: 402 });
  if (expectedTotal > 0 && balance < expectedTotal) return NextResponse.json({ error: `Saldo insuficiente. El despacho + recargo cuesta ${expectedTotal.toLocaleString("es-CL")} y tu saldo es ${balance.toLocaleString("es-CL")}.` }, { status: 402 });

  // ── Claim atómico: evita que varios clics rápidos creen varias entregas Uber.
  //    Solo UN request logra pasar uberDeliveryId de null → "PENDING" y crea.
  const claim = await prisma.posOrder.updateMany({
    where: { id: order.id, uberDeliveryId: null, pyaShippingId: null },
    data: { uberDeliveryId: "PENDING" },
  });
  if (claim.count === 0) {
    const cur = await prisma.posOrder.findUnique({ where: { id: order.id }, select: { courier: true } });
    return NextResponse.json({ ok: true, alreadyRequested: true, courier: cur?.courier });
  }

  const pickupPhone = order.restaurant.address ? (order.restaurant.phone || order.restaurant.whatsapp || "") : "";
  if (!order.restaurant.address || !pickupPhone) return NextResponse.json({ error: "Falta la dirección o teléfono del local (configúralos en el perfil)" }, { status: 400 });
  if (!order.addressLine || !order.customerPhone) return NextResponse.json({ error: "El pedido no tiene dirección o teléfono de entrega" }, { status: 400 });

  const items = Array.isArray(order.items) ? (order.items as any[]) : [];
  const params: CreateDeliveryParams = {
    pickupName: order.restaurant.name,
    pickupAddress: order.restaurant.address,
    pickupPhone,
    pickupLat: order.restaurant.lat,
    pickupLng: order.restaurant.lng,
    dropoffName: order.customerName,
    dropoffAddress: order.addressLine,
    dropoffPhone: order.customerPhone,
    dropoffLat: order.customerLat,
    dropoffLng: order.customerLng,
    manifestItems: items.length ? items.map((it) => ({ name: (it?.productName || it?.name || "Producto").toString(), quantity: Math.max(1, Number(it?.quantity) || 1) })).slice(0, 30) : [{ name: `Pedido ${order.orderReference || order.id.slice(-6)}`, quantity: 1 }],
    manifestTotalValue: order.totalAmount,
    externalId: order.id,
    quoteId,
  };

  const creds = uberSettingsFor(order.restaurant);
  let res = await uberCreateDelivery(creds, params);
  // Si la cotización ya venció, reintenta sin fijar el precio (Uber recotiza).
  if (!res.ok && quoteId) res = await uberCreateDelivery(creds, { ...params, quoteId: null });
  if (!res.ok || !res.delivery) {
    // Liberar el claim para permitir reintentar.
    await prisma.posOrder.updateMany({ where: { id: order.id, uberDeliveryId: "PENDING" }, data: { uberDeliveryId: null } });
    return NextResponse.json({ error: res.error || "No se pudo solicitar el repartidor" }, { status: 502 });
  }

  await prisma.posOrder.update({ where: { id: order.id }, data: { uberDeliveryId: res.delivery.deliveryId, courier: res.delivery as unknown as object, assignedTo: "Uber Direct" } });

  // Cobra el costo real del despacho + el recargo de plataforma al saldo prepago.
  const fee = res.delivery.fee ?? expectedFee;
  const surcharge = computeSurcharge(tiers, fee);
  const ref = order.orderReference || order.id.slice(-6);
  let newBalance = balance;
  if (fee > 0) {
    const charge = await chargeWallet(restaurantId, fee, { type: "charge", description: `Uber · despacho pedido ${ref}`, orderId: order.id, createdBy: "uber" });
    newBalance = charge.balance;
  }
  if (surcharge > 0) {
    const charge = await chargeWallet(restaurantId, surcharge, { type: "surcharge", description: `Recargo por repartidor externo · pedido ${ref}`, orderId: order.id, createdBy: "uber" });
    newBalance = charge.balance;
  }
  return NextResponse.json({ ok: true, courier: res.delivery, balance: newBalance, surcharge });
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

  // Si la solicitud aún estaba en curso (sentinel), solo se libera el claim.
  if (order.uberDeliveryId === "PENDING") {
    await prisma.posOrder.update({ where: { id }, data: { uberDeliveryId: null, courier: undefined as any, assignedTo: null } });
    return NextResponse.json({ ok: true });
  }

  const res = await uberCancelDelivery(uberSettingsFor(order.restaurant), order.uberDeliveryId);
  if (!res.ok) return NextResponse.json({ error: res.error || "No se pudo cancelar" }, { status: 502 });
  await prisma.posOrder.update({ where: { id }, data: { uberDeliveryId: null, courier: undefined as any, assignedTo: null } });

  // Reembolsa al saldo el costo cobrado por este despacho (neto, si quedó algo cobrado).
  const txns = await prisma.deliveryWalletTxn.findMany({ where: { restaurantId, orderId: id }, select: { amount: true } });
  const net = txns.reduce((s, t) => s + t.amount, 0); // cargos negativos + reembolsos positivos
  if (net < 0) await refundWallet(restaurantId, -net, { description: `Reembolso · courier cancelado pedido ${order.orderReference || id.slice(-6)}`, orderId: id, createdBy: "uber" });
  return NextResponse.json({ ok: true });
}
