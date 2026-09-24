import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { authDriver } from "@/lib/driver/auth";
import { readDriverBody } from "@/lib/driver/body";
import { syncOnlineOrderFromPos } from "@/lib/ecommerce/syncOnlineFromPos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/driver/order-action  Body: { delivery_id, action: take_order|deliver_order } */
export async function POST(req: NextRequest) {
  const driver = await authDriver(req);
  if (!driver) return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });

  const body = await readDriverBody(req);
  const id = (body?.delivery_id ?? body?.order_id ?? "").toString();
  const action = (body?.action || "").toString();
  if (!id || !action) return NextResponse.json({ ok: false, error: "Faltan parámetros." }, { status: 422 });

  const order = await prisma.posOrder.findUnique({ where: { id }, select: { id: true, restaurantId: true, externalId: true, opsStage: true, assignedDriverId: true, assignedTo: true, trackingToken: true } });
  if (!order || order.restaurantId !== driver.restaurantId) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  const origin = req.nextUrl.origin;

  if (action === "take_order") {
    const now = new Date();
    const res = await prisma.posOrder.updateMany({
      where: { id, opsStage: "ready", assignedDriverId: null },
      data: { opsStage: "out_for_delivery", assignedDriverId: driver.id, assignedTo: driver.displayName, isAssigned: true, opsDispatchedAt: now },
    });
    if (res.count === 0) {
      const msg = order.assignedDriverId ? "Este pedido ya fue tomado." : "Este pedido ya no está disponible.";
      return NextResponse.json({ ok: false, error: msg }, { status: 409 });
    }
    let token = order.trackingToken;
    if (!token) {
      token = crypto.randomBytes(20).toString("hex");
      await prisma.posOrder.update({ where: { id }, data: { trackingToken: token } }).catch(() => {});
    }
    void syncOnlineOrderFromPos({ restaurantId: order.restaurantId, externalId: order.externalId, opsStage: "out_for_delivery" }).catch(() => {});
    return NextResponse.json({ ok: true, action, delivery_id: id, order_id: id, tracking_url: token ? `${origin}/track/${token}` : null });
  }

  if (action === "deliver_order") {
    if (order.assignedDriverId && order.assignedDriverId !== driver.id) {
      return NextResponse.json({ ok: false, error: "Este pedido está asignado a otro repartidor." }, { status: 409 });
    }
    const res = await prisma.posOrder.updateMany({
      where: { id, opsStage: "out_for_delivery", assignedDriverId: driver.id },
      data: { opsStage: "delivered", opsDeliveredAt: new Date() },
    });
    if (res.count === 0) return NextResponse.json({ ok: false, error: "Este pedido no está en reparto." }, { status: 409 });
    void syncOnlineOrderFromPos({ restaurantId: order.restaurantId, externalId: order.externalId, opsStage: "delivered" }).catch(() => {});
    const token = order.trackingToken;
    return NextResponse.json({ ok: true, action, delivery_id: id, order_id: id, tracking_url: token ? `${origin}/track/${token}` : null });
  }

  return NextResponse.json({ ok: false, error: "Acción no soportada." }, { status: 409 });
}
