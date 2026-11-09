import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) {
    return teamMemberCanAccess(panelId.slice(3), restaurantId);
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/** POST /api/panel/ecommerce/print-clear-queue  { restaurantId }
 *  Vacía la cola de impresión del local: marca TODOS los pedidos pendientes de
 *  impresión (printedAt = null) como impresos (printedAt = ahora, printRequestedAt
 *  = null), de modo que el agente local (ESC/POS) deje de verlos en
 *  /api/print/queue y no los (re)imprima. No borra pedidos ni afecta su estado. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  if (!restaurantId) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const res = await prisma.onlineOrder.updateMany({
    where: { restaurantId, printedAt: null },
    data: { printedAt: new Date(), printRequestedAt: null },
  });
  return NextResponse.json({ ok: true, count: res.count });
}
