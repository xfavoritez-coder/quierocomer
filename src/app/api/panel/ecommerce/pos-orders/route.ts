import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOnlineOrderFromPos } from "@/lib/ecommerce/syncOnlineFromPos";
import { chileTodayYmd, chileDayRangeUtc } from "@/lib/driver/serialize";

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

  // Rango de fechas (YYYY-MM-DD en hora de Chile). Por defecto: hoy.
  const today = chileTodayYmd();
  const fromYmd = req.nextUrl.searchParams.get("from") || today;
  const toYmd = req.nextUrl.searchParams.get("to") || fromYmd;
  const start = chileDayRangeUtc(fromYmd).start;
  const end = chileDayRangeUtc(toYmd).end;
  const dateRange = { gte: start, lte: end };

  const where: any = { restaurantId };
  if (scope === "historial") {
    // Historial: entregados/cancelados creados dentro del rango.
    where.createdAt = dateRange;
    where.OR = [{ opsStage: "delivered" }, { posStatus: "canceled" }];
  } else {
    // Activos: los pedidos en curso (preparación/listo/reparto) se muestran SIEMPRE,
    // sin importar el día; los entregados solo dentro del rango seleccionado.
    where.posStatus = { not: "canceled" };
    where.OR = [
      { opsStage: { not: "delivered" } },
      { opsStage: "delivered", createdAt: dateRange },
    ];
  }

  const orders = await prisma.posOrder.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: scope === "historial" ? 300 : 400,
  });
  return NextResponse.json({ orders, from: fromYmd, to: toYmd, today });
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

  const order = await prisma.posOrder.findUnique({ where: { id }, select: { restaurantId: true, isDelivery: true, deliveryFee: true, opsReadyForDeliveryAt: true, opsDispatchedAt: true, restaurant: { select: { centroPedidosConfig: true } } } });
  if (!order || order.restaurantId !== restaurantId) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Un pedido con dirección pero sin monto de delivery se toma como retiro.
  const effectiveDelivery = order.isDelivery && (order.deliveryFee ?? 0) > 0;

  // Retiro + auto-entregar activado: al marcar "Listo" salta directo a "Entregado"
  // (los pedidos de retiro no tienen reparto; el cliente los retira al estar listos).
  let stage = opsStage;
  const cfg = order.restaurant?.centroPedidosConfig as { autoDeliverPickup?: boolean } | null;
  if (stage === "ready" && !effectiveDelivery && cfg?.autoDeliverPickup) stage = "delivered";

  // Timestamps de etapa (para el orden y los tiempos en la app del repartidor).
  const now = new Date();
  const data: any = { opsStage: stage };
  if (stage === "ready") data.opsReadyForDeliveryAt = order.opsReadyForDeliveryAt ?? now;
  if (stage === "out_for_delivery") data.opsDispatchedAt = order.opsDispatchedAt ?? now;
  if (stage === "delivered") {
    data.opsDeliveredAt = now;
    // Auto-entregado de retiro: deja marcado el "listo" para el registro de tiempos.
    if (opsStage === "ready") data.opsReadyForDeliveryAt = order.opsReadyForDeliveryAt ?? now;
  }
  // Si el local mueve un pedido "hacia atrás" a preparación, se libera la asignación.
  if (stage === "preparing" || stage === "ready") {
    data.assignedDriverId = null; data.assignedTo = null; data.isAssigned = false;
    if (stage === "preparing") data.opsReadyForDeliveryAt = null;
  }

  const updated = await prisma.posOrder.update({ where: { id }, data });
  void syncOnlineOrderFromPos(updated).catch(() => {});
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
