// Geocodificación de direcciones (Google Geocoding API) con la key del local.
import { prisma } from "@/lib/prisma";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";

export async function geocodeAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  if (!address || !apiKey) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&region=cl&components=country:CL`;
    const res = await fetch(url);
    const data = await res.json();
    const loc = data?.results?.[0]?.geometry?.location;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) return { lat: loc.lat, lng: loc.lng };
  } catch { /* noop */ }
  return null;
}

/** Geocodifica (y persiste) hasta `budget` PosOrders del set que tengan dirección
 *  pero les falten coordenadas. Devuelve un mapa id→{lat,lng} para usar en memoria. */
export async function geocodePosOrders(
  restaurant: { ecommerceConfig?: unknown } | null,
  orders: { id: string; addressLine: string; customerLat: number | null; customerLng: number | null }[],
  budget = 5,
): Promise<Map<string, { lat: number; lng: number }>> {
  const out = new Map<string, { lat: number; lng: number }>();
  const apiKey = parseEcommerceConfig(restaurant?.ecommerceConfig).googleMaps?.apiKey || "";
  if (!apiKey) return out;
  let used = 0;
  for (const o of orders) {
    if (used >= budget) break;
    if ((o.customerLat != null && o.customerLng != null) || !o.addressLine) continue;
    used++;
    const loc = await geocodeAddress(o.addressLine, apiKey);
    if (loc) {
      out.set(o.id, loc);
      prisma.posOrder.update({ where: { id: o.id }, data: { customerLat: loc.lat, customerLng: loc.lng } }).catch(() => {});
    }
  }
  return out;
}
