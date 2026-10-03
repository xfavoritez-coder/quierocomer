import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchOrderToPos } from "@/lib/ecommerce/pos";

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

/** POST /api/panel/ecommerce/resend-pos  { restaurantId, id }
 *  Reenvía manualmente el pedido al POS (Toteat) — útil cuando el envío
 *  automático falló (p. ej. la caja estaba cerrada en ese momento).
 *  dispatchOrderToPos es idempotente: si ya se envió (toteatOrderId), no duplica. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.onlineOrder.findFirst({ where: { id, restaurantId }, select: { id: true } });
  if (!order) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const res = await dispatchOrderToPos(order.id, { channel: "manual" }).catch((e) => ({ ok: false, message: String(e) }));
  if (!res.ok) return NextResponse.json({ error: res.message || "No se pudo enviar al POS" }, { status: 422 });

  // Devuelve el toteatOrderId actualizado para refrescar la UI.
  const updated = await prisma.onlineOrder.findUnique({ where: { id: order.id }, select: { toteatOrderId: true, posError: true } });
  return NextResponse.json({ ok: true, message: res.message, toteatOrderId: updated?.toteatOrderId ?? null, posError: updated?.posError ?? null });
}
