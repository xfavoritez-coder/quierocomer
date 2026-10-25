import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchToteatSales } from "@/lib/toteat/fetchSales";

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

/**
 * GET /api/panel/ecommerce/toteat-sales-total?restaurantId=&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Consume el endpoint /sales de Toteat (ventas totales del local, incluye salón/mesas),
 * no los pedidos sueltos del webhook. Devuelve { available, total, count, dineIn{...}, delivery{...} }.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  const from = req.nextUrl.searchParams.get("from") || "";
  const to = req.nextUrl.searchParams.get("to") || "";
  if (!restaurantId || !from || !to) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { toteatRestaurantId: true, toteatLocalId: true, toteatUserId: true, toteatApiToken: true },
  });
  if (!r?.toteatApiToken || !r.toteatRestaurantId || r.toteatLocalId == null || r.toteatUserId == null) {
    return NextResponse.json({ available: false, reason: "Este local no tiene la API de Toteat configurada." });
  }

  const credentials = {
    base: process.env.TOTEAT_API_BASE || "https://api.toteat.com/mw/or/1.0",
    xir: r.toteatRestaurantId,
    xil: r.toteatLocalId,
    xiu: r.toteatUserId,
    token: r.toteatApiToken,
  };
  const ini = from.replace(/-/g, "");
  const end = to.replace(/-/g, "");

  const resp = await fetchToteatSales({ ini, end, credentials });
  if (!resp.ok || !Array.isArray(resp.data)) {
    const msg = typeof resp.msg === "string" ? resp.msg : (resp.msg as { texto?: string } | undefined)?.texto;
    // Credenciales/scope de /sales no válidos (p.ej. "Not Authorized"): no mostramos el KPI.
    return NextResponse.json({ available: false, reason: msg || "La API de ventas de Toteat no está disponible para este local." });
  }

  let total = 0, count = 0, dineInTotal = 0, dineInCount = 0, deliveryTotal = 0, deliveryCount = 0;
  for (const sale of resp.data) {
    const amt = Number(sale.total) || 0;
    total += amt; count++;
    // En /sales las mesas virtuales (canal online) vienen con tableId "V-..." o
    // tableName "Virtual"; una mesa física real tiene otro tableId/tableName.
    const tid = sale.tableId != null ? String(sale.tableId) : "";
    const tname = String((sale as { tableName?: string }).tableName || "").toLowerCase();
    const isVirtual = tid === "" || tid.startsWith("V-") || tid.startsWith("-") || tname === "virtual";
    if (!isVirtual) { dineInTotal += amt; dineInCount++; }
    else { deliveryTotal += amt; deliveryCount++; }
  }

  return NextResponse.json({
    available: true,
    total: Math.round(total), count,
    dineIn: { total: Math.round(dineInTotal), count: dineInCount },
    delivery: { total: Math.round(deliveryTotal), count: deliveryCount },
  });
}
