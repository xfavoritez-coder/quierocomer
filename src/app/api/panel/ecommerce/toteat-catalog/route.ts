import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig, TOTEAT_DEFAULT_API_URL } from "@/lib/ecommerce/config";
import { fetchToteatProducts } from "@/lib/toteat/fetchProducts";

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

/** GET /api/panel/ecommerce/toteat-catalog?restaurantId=X
 *  Devuelve el catálogo del POS Toteat como { code: name } para mostrar el nombre
 *  del producto Toteat al asignar un código en la carta del ecommerce. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId") || "";
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceConfig: true } });
  const t = parseEcommerceConfig(r?.ecommerceConfig).pos?.toteat;
  if (!t?.xir || !t?.xil || !t?.token) return NextResponse.json({ ok: false, error: "Toteat no configurado", map: {} });

  const credentials = {
    base: (t.apiUrl || TOTEAT_DEFAULT_API_URL).replace(/\/$/, ""),
    xir: t.xir,
    xil: t.xil,
    xiu: t.xiu || t.xil,
    token: t.token,
  };

  const res = await fetchToteatProducts({ credentials, activeOnly: false });
  if (!res.data || !Array.isArray(res.data)) {
    return NextResponse.json({ ok: false, error: typeof res.msg === "string" ? res.msg : (res.msg?.texto || "No se pudo leer el catálogo de Toteat"), map: {} });
  }

  // Mapa código→nombre (clave normalizada en mayúsculas para el lookup).
  const map: Record<string, string> = {};
  for (const p of res.data) {
    if (p?.id) map[String(p.id).trim().toUpperCase()] = p.name || "";
  }
  return NextResponse.json({ ok: true, count: Object.keys(map).length, map });
}
