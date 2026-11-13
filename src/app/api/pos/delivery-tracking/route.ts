// ═══════════════════════════════════════════════════════════
//  Seguimiento del reparto (Delifast) para el POS — LECTURA.
//  GET /api/pos/delivery-tracking?restaurantId=X&posOrderId=Y
//  Devuelve el tracking que PERSISTE el worker central
//  (/api/cron/delifast-tracking) en PosOrder.delifastTracking. La UI ya NO raspa
//  Delifast por pantalla: solo lee la BD. Si el worker aún no lo cargó → pending.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { teamMemberCanAccess } from "@/lib/ecommerce/panelAuth";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function assertOwnership(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId === "demo") return true;
  if (panelId.startsWith("tm_")) return teamMemberCanAccess(panelId.slice(3), restaurantId);
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const posOrderId = req.nextUrl.searchParams.get("posOrderId") || "";
  if (!restaurantId || !posOrderId) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findFirst({
    where: { id: posOrderId, restaurantId },
    select: { delifastTracking: true, delifastTrackedAt: true, delifastVentaId: true, restaurant: { select: { ecommerceConfig: true } } },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  // ¿El local tiene Delifast configurado? (no se descifra: basta saber si está activo)
  const creds = parseEcommerceConfig(order.restaurant?.ecommerceConfig).delifast;
  const configured = !!(creds?.enabled && creds.email && creds.plataforma);
  if (!configured) return NextResponse.json({ ok: true, configured: false });

  if (order.delifastTracking) {
    return NextResponse.json({ ok: true, configured: true, tracking: order.delifastTracking, trackedAt: order.delifastTrackedAt });
  }
  // El worker aún no cargó el seguimiento (pedido recién creado / sin viaje en Delifast).
  return NextResponse.json({ ok: true, configured: true, pending: true });
}
