import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadEcommerceStorefront } from "@/lib/ecommerce/storefront-data";

export const runtime = "nodejs";

// Verifica que el panel_id de la cookie tenga acceso al restaurante (owner o team member).
async function verifyAccess(req: NextRequest, restaurantId: string): Promise<boolean> {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return false;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    return m?.restaurantId === restaurantId;
  }
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
  return r?.ownerId === panelId;
}

/**
 * GET /api/panel/ecommerce/menu?restaurantId=…
 * Devuelve el catálogo del ecommerce (tenant + categorías + productos con
 * modificadores) para la pantalla "Tomar pedidos". Mismo shape que el storefront.
 */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "restaurantId requerido" }, { status: 400 });

  if (!(await verifyAccess(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { slug: true, ecommerceEnabled: true } });
  if (!r || !r.ecommerceEnabled) return NextResponse.json({ error: "Ecommerce no habilitado" }, { status: 404 });

  const data = await loadEcommerceStorefront(r.slug);
  if (!data) return NextResponse.json({ error: "No se pudo cargar el catálogo" }, { status: 404 });

  return NextResponse.json(data);
}
