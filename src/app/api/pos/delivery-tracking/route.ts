// ═══════════════════════════════════════════════════════════
//  Seguimiento enriquecido del reparto (Delifast) para el POS.
//  GET /api/pos/delivery-tracking?restaurantId=X&posOrderId=Y
//  Devuelve repartidor, estado, ETA, PIN, ubicación en vivo y
//  timeline, consultando el panel de Delifast con el login del
//  local (ver src/lib/delifast/client.ts). Respuesta cacheada ~8s
//  para no golpear Delifast en cada poll del POS.
// ═══════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { getDelifastTracking, type DelifastTracking } from "@/lib/delifast/client";

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

// Cache en memoria por id de venta Delifast (clave = restaurantId:idVenta).
const cache = new Map<string, { at: number; data: DelifastTracking | null }>();
const CACHE_MS = 8000;

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const posOrderId = req.nextUrl.searchParams.get("posOrderId") || "";
  if (!restaurantId || !posOrderId) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findFirst({
    where: { id: posOrderId, restaurantId },
    select: { delifastVentaId: true, isDelivery: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const cfg = parseEcommerceConfig(
    (await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceConfig: true } }))?.ecommerceConfig,
  );
  const creds = cfg.delifast;
  const configured = !!(creds?.enabled && creds.email && creds.password && creds.plataforma);
  if (!configured) return NextResponse.json({ ok: true, configured: false });

  // Sin id de venta Delifast todavía (el worker aún no recibió un cambio-estado).
  if (!order.delifastVentaId) return NextResponse.json({ ok: true, configured: true, pending: true });

  const ckey = `${restaurantId}:${order.delifastVentaId}`;
  const hit = cache.get(ckey);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ ok: true, configured: true, tracking: hit.data });
  }

  try {
    const tracking = await getDelifastTracking(restaurantId, creds!, order.delifastVentaId);
    cache.set(ckey, { at: Date.now(), data: tracking });
    return NextResponse.json({ ok: true, configured: true, tracking });
  } catch (e) {
    console.error("[delivery-tracking] Delifast:", (e as Error)?.message);
    return NextResponse.json({ ok: true, configured: true, error: "No se pudo leer Delifast" }, { status: 200 });
  }
}
