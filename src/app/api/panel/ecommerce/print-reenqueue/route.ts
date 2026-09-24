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

/** POST /api/panel/ecommerce/print-reenqueue  { restaurantId, id }
 *  Marca el pedido como "no impreso" (printedAt = null) para que el agente de
 *  impresión local (ESC/POS) lo tome en su próximo sondeo de /api/print/queue e
 *  imprima (o reimprima) la comanda. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const res = await prisma.onlineOrder.updateMany({
    where: { id, restaurantId },
    data: { printedAt: null },
  });
  if (res.count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
