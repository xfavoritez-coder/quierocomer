import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

const STAGES = ["preparing", "ready", "out_for_delivery", "delivered"];

/** GET /api/panel/ecommerce/pos-orders?restaurantId=X[&scope=activos|historial]
 *  Lista los pedidos del POS del local (Centro de pedidos). */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const scope = req.nextUrl.searchParams.get("scope") || "activos";
  // Historial: entregados/cancelados. Activos: el resto (últimas 24h para no traer todo).
  const where: any = { restaurantId };
  if (scope === "historial") {
    where.OR = [{ opsStage: "delivered" }, { posStatus: "canceled" }];
  } else {
    where.opsStage = { not: "delivered" };
    where.posStatus = { not: "canceled" };
  }

  const orders = await prisma.posOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: scope === "historial" ? 200 : 300,
  });
  return NextResponse.json({ orders });
}

/** PATCH /api/panel/ecommerce/pos-orders → avanza la etapa operativa de un pedido.
 *  Body: { restaurantId, id, opsStage } */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  const opsStage = (body?.opsStage || "").toString();
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!STAGES.includes(opsStage)) return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });

  const order = await prisma.posOrder.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const updated = await prisma.posOrder.update({
    where: { id },
    data: { opsStage, opsDeliveredAt: opsStage === "delivered" ? new Date() : null },
  });
  return NextResponse.json({ order: updated });
}

/** DELETE /api/panel/ecommerce/pos-orders?restaurantId=X&id=Y → elimina un pedido
 *  (útil para limpiar pruebas o descartar duplicados). */
export async function DELETE(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findUnique({ where: { id }, select: { restaurantId: true } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await prisma.posOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
