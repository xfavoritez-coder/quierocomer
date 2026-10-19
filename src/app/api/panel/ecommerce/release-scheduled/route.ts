import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseScheduledOrder } from "@/lib/ecommerce/releaseScheduled";

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

/** POST /api/panel/ecommerce/release-scheduled  { restaurantId, id }
 *  "Saltar programado": libera YA un pedido programado (deja de estar en espera,
 *  se despacha al POS/Toteat, se espeja al Centro y se avisa al local), igual que
 *  cuando el cron lo liberaría en su hora objetivo. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.onlineOrder.findFirst({
    where: { id, restaurantId },
    select: { id: true, scheduledFor: true, scheduledReleasedAt: true, status: true, paymentGateway: true, paymentStatus: true },
  });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!order.scheduledFor) return NextResponse.json({ error: "Este pedido no es programado" }, { status: 400 });
  if (order.scheduledReleasedAt) return NextResponse.json({ error: "El pedido ya fue liberado" }, { status: 400 });
  if (order.status === "CANCELLED") return NextResponse.json({ error: "El pedido está cancelado" }, { status: 400 });
  // Pago online no confirmado: no liberar (no despachar pedidos sin pagar).
  if (order.paymentGateway && order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "El pedido aún no está pagado" }, { status: 400 });
  }

  const res = await releaseScheduledOrder(order.id);
  if (!res.ok) return NextResponse.json({ error: "No se pudo liberar el pedido" }, { status: 422 });
  return NextResponse.json({ ok: true });
}
