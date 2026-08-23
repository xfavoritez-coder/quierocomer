import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig, integrationStatus } from "@/lib/ecommerce/config";

/**
 * GET /api/panel/ecommerce/status?restaurantId=...
 * Devuelve si el pilar Ecommerce está habilitado y qué integraciones
 * están configuradas (solo booleans, nunca secretos).
 */
export async function GET(req: NextRequest) {
  const panelId = req.cookies.get("panel_id")?.value;
  if (!panelId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });

  // Verificar pertenencia (owner o team member)
  let allowed = false;
  if (panelId.startsWith("tm_")) {
    const m = await prisma.teamMember.findUnique({ where: { id: panelId.slice(3) }, select: { restaurantId: true } });
    allowed = m?.restaurantId === restaurantId;
  } else if (panelId === "demo") {
    allowed = true;
  } else {
    const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ownerId: true } });
    allowed = r?.ownerId === panelId;
  }
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { ecommerceEnabled: true, ecommerceConfig: true },
  });
  if (!restaurant) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const cfg = parseEcommerceConfig(restaurant.ecommerceConfig);
  return NextResponse.json({
    enabled: !!restaurant.ecommerceEnabled,
    integrations: integrationStatus(cfg),
    webpayEnv: cfg.webpay?.env || "integration",
    posProvider: cfg.pos?.provider || "none",
    googleMapsKey: cfg.googleMaps?.apiKey || null, // key de navegador, para el mini-mapa del courier
  });
}
