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

/** POST /api/panel/ecommerce/print-reenqueue  { restaurantId, id }
 *  Marca el pedido como "no impreso" (printedAt = null) para que el agente de
 *  impresión local (ESC/POS) lo tome en su próximo sondeo de /api/print/queue e
 *  imprima (o reimprima) la comanda. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = (body?.restaurantId || "").toString();
  const id = (body?.id || "").toString();
  // ticketOnly=true: reimprime SOLO el ticket (sin la comanda de cocina aunque el
  // local la tenga activada). Lo usa el botón "Imprimir ticket" del POS, que tiene
  // su propio botón aparte para la comanda de cocina.
  const ticketOnly = body?.ticketOnly === true;
  // kitchenOnly: reimprime SOLO la comanda de cocina (sin ticket de caja). Lo usa
  // "Comanda cocina" cuando el equipo no tiene agente local (ej. el Mac) y reenvía
  // por el servidor. Se marca en deliveryAddressParts (preservando la dirección si
  // es delivery); la cola emite únicamente la comanda de cocina.
  const kitchenOnly = body?.kitchenOnly === true;
  // precuentaEscpos: ESC/POS ya renderizado de la precuenta de garzones (reenviado
  // desde un equipo sin agente local). La cola lo emite tal cual para la impresora
  // de la caja. One-shot: el ack lo limpia.
  const precuentaEscpos = typeof body?.precuentaEscpos === "string" && body.precuentaEscpos.length > 0 ? body.precuentaEscpos : null;
  if (!restaurantId || !id) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const existing = await prisma.onlineOrder.findFirst({ where: { id, restaurantId }, select: { deliveryAddressParts: true } });
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const parts = (existing.deliveryAddressParts && typeof existing.deliveryAddressParts === "object" && !Array.isArray(existing.deliveryAddressParts))
    ? { ...(existing.deliveryAddressParts as Record<string, unknown>) } : {};
  if (kitchenOnly) parts.kitchenOnly = true; else delete parts.kitchenOnly;
  if (precuentaEscpos) parts.precuentaEscpos = precuentaEscpos; else delete parts.precuentaEscpos;

  await prisma.onlineOrder.update({
    where: { id },
    data: {
      printedAt: null,
      printRequestedAt: new Date(),
      reprintTicketOnly: kitchenOnly ? false : ticketOnly,
      deliveryAddressParts: (Object.keys(parts).length ? parts : null) as object,
    },
  });
  return NextResponse.json({ ok: true });
}
