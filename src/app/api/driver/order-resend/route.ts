import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authDriver } from "@/lib/driver/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/driver/order-resend  Body: { delivery_id, responsible_id } */
export async function POST(req: NextRequest) {
  const driver = await authDriver(req);
  if (!driver) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = (body?.delivery_id ?? "").toString();
  const responsibleId = (body?.responsible_id ?? "").toString();
  if (!id || !responsibleId) return NextResponse.json({ ok: false, error: "Faltan parámetros." }, { status: 422 });

  const order = await prisma.posOrder.findUnique({ where: { id }, select: { id: true, restaurantId: true, opsStage: true, assignedDriverId: true, deliveryFee: true } });
  if (!order || order.restaurantId !== driver.restaurantId) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  if (order.opsStage !== "delivered") return NextResponse.json({ ok: false, error: "Solo se puede registrar reenvío para pedidos entregados." }, { status: 409 });
  if (order.assignedDriverId !== driver.id) return NextResponse.json({ ok: false, error: "Este pedido no pertenece al repartidor autenticado." }, { status: 409 });

  const resp = await prisma.deliveryResponsible.findUnique({ where: { id: responsibleId }, select: { id: true, name: true, restaurantId: true, active: true } });
  if (!resp || resp.restaurantId !== driver.restaurantId || !resp.active) return NextResponse.json({ ok: false, error: "Responsable inválido." }, { status: 409 });

  const extra = Math.max(0, order.deliveryFee || 0);
  const created = await prisma.posOrderResend.create({
    data: { posOrderId: id, responsibleId: resp.id, responsibleName: resp.name, extraDeliveryAmount: extra, createdByDriverId: driver.id, createdByDriverName: driver.displayName },
  });
  const agg = await prisma.posOrderResend.aggregate({ where: { posOrderId: id }, _count: true, _sum: { extraDeliveryAmount: true } });

  return NextResponse.json({
    ok: true,
    delivery_id: id,
    order_id: id,
    resend_id: created.id,
    responsible_id: resp.id,
    responsible_name: resp.name,
    extra_delivery_amount: extra,
    resend_count: agg._count,
    resend_extra_delivery: agg._sum.extraDeliveryAmount || 0,
  });
}
