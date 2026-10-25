import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseDeliveryConfig, computeDistanceFee } from "@/lib/ecommerce/delivery";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";
import { uberSettingsFor, uberConfigured, uberCreateQuote, uberQuoteErrorEs } from "@/lib/ecommerce/uberDirect";
import { getSurchargeTiers, computeSurcharge } from "@/lib/ecommerce/deliverySurcharge";
import { parseCentroPedidosConfig } from "@/lib/ecommerce/config";

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

  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { ecommerceDeliveryConfig: true, ecommerceConfig: true, address: true, centroPedidosConfig: true } });
  if (!r) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const dcfg = parseDeliveryConfig(r.ecommerceDeliveryConfig);
  const absorbsSurcharge = parseCentroPedidosConfig(r.centroPedidosConfig).customerAbsorbsSurcharge === true;

  // Cotiza el fee según las coordenadas del destino y el modo configurado.
  async function quoteFor(lat: number, lng: number, formatted: string) {
    if (dcfg.mode === "uber") {
      const creds = uberSettingsFor(r);
      if (!uberConfigured(creds)) return NextResponse.json({ available: false, reason: "Uber Direct no está configurado en este local." });
      const q = await uberCreateQuote(creds, {
        pickupAddress: dcfg.originAddress || r!.address || "",
        pickupLat: dcfg.origin?.lat ?? null,
        pickupLng: dcfg.origin?.lng ?? null,
        dropoffAddress: formatted,
        dropoffLat: lat,
        dropoffLng: lng,
      });
      if (!q.ok) return NextResponse.json({ available: false, reason: uberQuoteErrorEs(q.error) });
      // Si el cliente paga el cargo de servicio, se suma el recargo al despacho.
      const surcharge = absorbsSurcharge ? computeSurcharge(await getSurchargeTiers(), q.fee ?? 0) : 0;
      return NextResponse.json({ available: true, fee: (q.fee ?? 0) + surcharge, courierFee: q.fee, surcharge, formatted, lat, lng, source: "uber" });
    }
    const res = computeDistanceFee(dcfg, { lat, lng });
    if (!res.available) return NextResponse.json({ available: false, reason: res.reason || "Fuera de la zona de reparto." });
    return NextResponse.json({ available: true, fee: res.fee, formatted, lat, lng });
  }

  // Si el cliente ya resolvió la dirección con Autocomplete (coordenadas
  // precisas de Google Places), usamos ESAS y no re-geocodificamos (evita que
  // "Rojas Magallanes 926" sin comuna caiga en un punto equivocado).
  const latIn = Number(body?.lat);
  const lngIn = Number(body?.lng);
  if (Number.isFinite(latIn) && Number.isFinite(lngIn)) {
    return quoteFor(latIn, lngIn, address);
  }

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
    return quoteFor(lat, lng, result.formatted_address as string);
  } catch {
    return NextResponse.json({ available: false, reason: "Error al calcular el envío." });
  }
}
