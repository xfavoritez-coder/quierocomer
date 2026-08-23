import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDeliveryConfig, computeDistanceFee } from "@/lib/ecommerce/delivery";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";

export const runtime = "nodejs";

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
 * POST /api/panel/ecommerce/delivery-quote { restaurantId, address }
 * Para el modo "distance": geocodifica la dirección (sesgada a Chile) con la key
 * del local y calcula el fee con computeDistanceFee (mismo modelo que el checkout).
 * Devuelve { available, fee, formatted, lat, lng, reason }.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const restaurantId = body?.restaurantId as string | undefined;
  const address = (body?.address as string | undefined)?.trim();
  if (!restaurantId || !address) return NextResponse.json({ error: "restaurantId y address requeridos" }, { status: 400 });

  if (!(await verifyAccess(req, restaurantId))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceDeliveryConfig: true, ecommerceConfig: true } });
  if (!r) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const dcfg = parseDeliveryConfig(r.ecommerceDeliveryConfig);
  const key = parseEcommerceConfig(r.ecommerceConfig).googleMaps?.apiKey;
  if (!key) return NextResponse.json({ available: false, reason: "El local no tiene Google Maps configurado; ingresa el envío manualmente." });

  try {
    const addrForGeo = address.toLowerCase().includes("chile") ? address : `${address}, Chile`;
    const params = new URLSearchParams({ address: addrForGeo, key, region: "cl", language: "es", components: "country:CL" });
    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const geo = await geoRes.json();
    if (!geo.results?.length) return NextResponse.json({ available: false, reason: "Dirección no encontrada." });

    const result = geo.results[0];
    const gTypes: string[] = result.types ?? [];
    const locationType: string = result.geometry?.location_type ?? "";
    const vague = ["locality", "sublocality", "political", "administrative_area_level_1", "administrative_area_level_2", "administrative_area_level_3", "country", "route"];
    if (result.partial_match || locationType === "APPROXIMATE" || gTypes.some((t) => vague.includes(t))) {
      return NextResponse.json({ available: false, reason: "Dirección imprecisa. Incluye calle, número y comuna (con tildes)." });
    }

    const lat = result.geometry.location.lat as number;
    const lng = result.geometry.location.lng as number;
    const res = computeDistanceFee(dcfg, { lat, lng });
    if (!res.available) return NextResponse.json({ available: false, reason: res.reason || "Fuera de la zona de reparto." });

    return NextResponse.json({ available: true, fee: res.fee, formatted: result.formatted_address as string, lat, lng });
  } catch {
    return NextResponse.json({ available: false, reason: "Error al calcular el envío." });
  }
}
