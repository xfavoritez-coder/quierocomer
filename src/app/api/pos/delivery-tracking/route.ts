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
import { getPlatformSetting } from "@/lib/platformSettings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache corto del flag de pausa (se consulta en cada poll de cada tarjeta).
let pausedCache: { at: number; val: boolean } | null = null;
async function isPaused(): Promise<boolean> {
  if (pausedCache && Date.now() - pausedCache.at < 10_000) return pausedCache.val;
  const val = (await getPlatformSetting("delifast_tracking_paused")) === "1";
  pausedCache = { at: Date.now(), val };
  return val;
}

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
  // Sin seguimiento persistido. Si la sincronización (scraping) está pausada y el
  // webhook aún no cargó datos, NO es que Delifast no asigne: es que no estamos
  // consultando → `paused` (la UI no muestra la alerta). Si está activo → `pending`.
  if (await isPaused()) return NextResponse.json({ ok: true, configured: true, paused: true });
  return NextResponse.json({ ok: true, configured: true, pending: true });
}
