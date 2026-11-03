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
import { decryptEcommerceSecrets } from "@/lib/ecommerce/configSecrets";
import { getDelifastTracking, resolveDelifastVentaId, type DelifastTracking } from "@/lib/delifast/client";

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
// Cache negativo de resolución (pedido aún no visible en Delifast): evita re-bajar
// el listado completo en cada poll mientras no aparece.
const resolveNeg = new Map<string, number>();
const RESOLVE_NEG_MS = 25000;

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const posOrderId = req.nextUrl.searchParams.get("posOrderId") || "";
  if (!restaurantId || !posOrderId) return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const order = await prisma.posOrder.findFirst({
    where: { id: posOrderId, restaurantId },
    select: { delifastVentaId: true, isDelivery: true, orderReference: true },
  });
  if (!order) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const cfg = decryptEcommerceSecrets(parseEcommerceConfig(
    (await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceConfig: true } }))?.ecommerceConfig,
  ));
  const creds = cfg.delifast;
  const configured = !!(creds?.enabled && creds.email && creds.password && creds.plataforma);
  if (!configured) return NextResponse.json({ ok: true, configured: false });

  // Resolver el id_venta de Delifast. Si el worker ya lo guardó, se usa; si no,
  // se busca en Delifast por nuestro orderNumber (codigo_origen) y se persiste, así
  // el seguimiento aparece aunque el pedido no haya avanzado de estado todavía.
  let idVenta = order.delifastVentaId;
  if (!idVenta && order.orderReference) {
    const negKey = `${restaurantId}:${order.orderReference}`;
    const lastNeg = resolveNeg.get(negKey);
    if (!lastNeg || Date.now() - lastNeg > RESOLVE_NEG_MS) {
      idVenta = await resolveDelifastVentaId(restaurantId, creds!, order.orderReference).catch(() => null);
      if (idVenta) {
        resolveNeg.delete(negKey);
        await prisma.posOrder.update({ where: { id: posOrderId }, data: { delifastVentaId: idVenta } }).catch(() => {});
      } else {
        resolveNeg.set(negKey, Date.now());
      }
    }
  }
  if (!idVenta) return NextResponse.json({ ok: true, configured: true, pending: true });

  const ckey = `${restaurantId}:${idVenta}`;
  const hit = cache.get(ckey);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return NextResponse.json({ ok: true, configured: true, tracking: hit.data });
  }

  try {
    const tracking = await getDelifastTracking(restaurantId, creds!, idVenta);
    cache.set(ckey, { at: Date.now(), data: tracking });
    return NextResponse.json({ ok: true, configured: true, tracking });
  } catch (e) {
    console.error("[delivery-tracking] Delifast:", (e as Error)?.message);
    return NextResponse.json({ ok: true, configured: true, error: "No se pudo leer Delifast" }, { status: 200 });
  }
}
