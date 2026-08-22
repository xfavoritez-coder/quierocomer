import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDeliveryZones, parseDeliveryConfig } from "@/lib/ecommerce/delivery";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";

/** Verifica que el panel logueado sea dueño (o miembro) del restaurante. */
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

/** GET → zonas por comuna + config por distancia + si delivery está activo + key de Google Maps. */
export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get("restaurantId");
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { ecommerceDeliveryZones: true, ecommerceDeliveryConfig: true, ecommerceConfig: true, orderingDelivery: true, address: true },
  });
  if (!r) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({
    zones: parseDeliveryZones(r.ecommerceDeliveryZones),
    config: parseDeliveryConfig(r.ecommerceDeliveryConfig),
    deliveryEnabled: (r.orderingDelivery || "").toUpperCase() !== "PICKUP",
    googleMapsKey: parseEcommerceConfig(r.ecommerceConfig).googleMaps?.apiKey || null,
    restaurantAddress: r.address || null,
  });
}

/** PUT → guarda zonas y/o config de distancia del local. */
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = body?.restaurantId as string | undefined;
  if (!restaurantId) return NextResponse.json({ error: "Falta restaurantId" }, { status: 400 });
  if (!(await assertOwnership(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const data: Record<string, unknown> = {};
  if (body.zones !== undefined) data.ecommerceDeliveryZones = parseDeliveryZones(body.zones) as unknown as object;
  if (body.config !== undefined) data.ecommerceDeliveryConfig = parseDeliveryConfig(body.config) as unknown as object;

  const updated = await prisma.restaurant.update({
    where: { id: restaurantId },
    data,
    select: { ecommerceDeliveryZones: true, ecommerceDeliveryConfig: true },
  });
  return NextResponse.json({ ok: true, zones: parseDeliveryZones(updated.ecommerceDeliveryZones), config: parseDeliveryConfig(updated.ecommerceDeliveryConfig) });
}
