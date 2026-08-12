import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, orderInDeliveryEmailHtml, orderAcceptedEmailHtml } from "@/lib/email/sendAdminEmail";

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

// Valid status transitions
const TRANSITIONS: Record<string, string[]> = {
  PENDING:      ["ACCEPTED", "CANCELLED"],
  ACCEPTED:     ["PREPARING", "CANCELLED"],
  PREPARING:    ["IN_DELIVERY", "READY", "CANCELLED"],
  IN_DELIVERY:  ["DONE", "CANCELLED"],
  READY:        ["DONE", "CANCELLED"],
  DONE:         [],
  CANCELLED:    [],
};

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId required" }, { status: 400 });

  const allowed = await verifyAccess(req, restaurantId);
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const orders = await prisma.onlineOrder.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return NextResponse.json({ orders });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.orderId || !body?.status) {
    return NextResponse.json({ error: "orderId y status requeridos" }, { status: 400 });
  }

  const { cancellationReason } = body;

  const order = await prisma.onlineOrder.findUnique({
    where: { id: body.orderId },
    select: { id: true, restaurantId: true, status: true, customerName: true, customerEmail: true, total: true, orderType: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const allowed = await verifyAccess(req, order.restaurantId);
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const validNext = TRANSITIONS[order.status] ?? [];
  if (!validNext.includes(body.status)) {
    return NextResponse.json({ error: `No se puede pasar de ${order.status} a ${body.status}` }, { status: 422 });
  }

  if (body.status === "CANCELLED" && (!cancellationReason || typeof cancellationReason !== "string" || !cancellationReason.trim())) {
    return NextResponse.json({ error: "Se requiere el motivo de cancelación" }, { status: 422 });
  }

  const updated = await prisma.onlineOrder.update({
    where: { id: order.id },
    data: {
      status: body.status,
      ...(body.status === "CANCELLED" && cancellationReason ? { cancellationReason: cancellationReason.trim() } : {}),
    },
  });

  // Send email to customer on status changes
  if ((body.status === "ACCEPTED" || body.status === "IN_DELIVERY" || body.status === "READY") && order.customerEmail) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: order.restaurantId },
      select: { name: true, orderingWaitTime: true },
    });

    const emailOpts = body.status === "ACCEPTED"
      ? {
          subject: "¡Tu pedido fue aceptado! ✅",
          html: orderAcceptedEmailHtml({
            customerName: order.customerName,
            restaurantName: restaurant?.name ?? "",
            total: order.total,
            orderType: order.orderType,
            estimatedTime: restaurant?.orderingWaitTime ?? null,
            trackingUrl: `https://quierocomer.com/pedido/${order.id}`,
          }),
        }
      : {
          subject: body.status === "IN_DELIVERY" ? "¡Tu pedido está en camino! 🛵" : "¡Tu pedido está listo! ✅",
          html: orderInDeliveryEmailHtml({
            customerName: order.customerName,
            restaurantName: restaurant?.name ?? "",
            total: order.total,
            orderType: order.orderType,
            estimatedTime: restaurant?.orderingWaitTime ?? null,
          }),
        };

    sendAdminEmail({
      to: order.customerEmail,
      ...emailOpts,
      purpose: "order",
    }).catch((err) => {
      console.error(`[orders PATCH] email send failed to ${order.customerEmail}:`, err?.message ?? err);
    });
  }

  return NextResponse.json({ order: updated });
}
