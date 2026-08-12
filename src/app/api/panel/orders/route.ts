import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAdminEmail, orderInDeliveryEmailHtml } from "@/lib/email/sendAdminEmail";

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

  const updated = await prisma.onlineOrder.update({
    where: { id: order.id },
    data: { status: body.status },
  });

  // Send email to customer when order goes out for delivery or is ready for pickup
  if ((body.status === "IN_DELIVERY" || body.status === "READY") && order.customerEmail) {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: order.restaurantId },
      select: { name: true, orderingWaitTime: true },
    });
    sendAdminEmail({
      to: order.customerEmail,
      subject: body.status === "IN_DELIVERY" ? "¡Tu pedido está en camino! 🛵" : "¡Tu pedido está listo! ✅",
      html: orderInDeliveryEmailHtml({
        customerName: order.customerName,
        restaurantName: restaurant?.name ?? "",
        total: order.total,
        orderType: order.orderType,
        estimatedTime: restaurant?.orderingWaitTime ?? null,
      }),
      purpose: "other",
      skipLog: true,
    }).catch(() => {});
  }

  return NextResponse.json({ order: updated });
}
