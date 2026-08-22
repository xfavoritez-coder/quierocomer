// ═══════════════════════════════════════════════════════════
//  Zonas de delivery del Ecommerce.
//  Cada local se autoadministra sus zonas (comuna/sector + tarifa).
//  Se guardan en Restaurant.ecommerceDeliveryZones (JSON).
// ═══════════════════════════════════════════════════════════

export interface DeliveryZone {
  id: string;
  name: string; // comuna o nombre del sector
  fee: number; // costo de despacho en CLP
  minOrder?: number | null; // pedido mínimo para esa zona (opcional)
  estimatedTime?: string | null; // ej: "30-45 min" (opcional)
  active: boolean;
}

/** Normaliza el JSON crudo a un arreglo de zonas seguro. */
export function parseDeliveryZones(raw: unknown): DeliveryZone[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((z) => z && typeof z === "object")
    .map((z) => {
      const o = z as Record<string, unknown>;
      return {
        id: String(o.id ?? cryptoId()),
        name: String(o.name ?? "").trim(),
        fee: Math.max(0, Math.round(Number(o.fee) || 0)),
        minOrder: o.minOrder == null || o.minOrder === "" ? null : Math.max(0, Math.round(Number(o.minOrder) || 0)),
        estimatedTime: o.estimatedTime ? String(o.estimatedTime) : null,
        active: o.active !== false,
      } as DeliveryZone;
    })
    .filter((z) => z.name.length > 0);
}

function cryptoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ═══════════════════════════════════════════════════════════
//  Delivery por polígono + distancia (modelo de deliveryalfredograterol).
//  Cobertura = polígono incluido (y opcional excluido); tarifa = base +
//  distancia(km) × precio_por_km, redondeada al múltiplo más cercano.
// ═══════════════════════════════════════════════════════════

export interface LatLng {
  lat: number;
  lng: number;
}

export type DeliveryMode = "zones" | "distance";

export interface DeliveryConfig {
  mode: DeliveryMode;
  origin: LatLng | null; // ubicación del local
  originAddress?: string | null;
  basePrice: number; // tarifa base
  pricePerKm: number; // costo por km
  roundingMult: number; // redondeo del total (ej: 100)
  polygonIncluded: LatLng[]; // perímetro de reparto (cobertura, un solo anillo)
  polygonExcluded: LatLng[][]; // zonas excluidas (varias, cada una un anillo)
}

export function defaultDeliveryConfig(): DeliveryConfig {
  return { mode: "zones", origin: null, originAddress: null, basePrice: 0, pricePerKm: 0, roundingMult: 100, polygonIncluded: [], polygonExcluded: [] };
}

function toLatLngArray(raw: unknown): LatLng[] {
  if (!Array.isArray(raw)) return [];
  const out: LatLng[] = [];
  for (const p of raw) {
    if (p && typeof p === "object") {
      const o = p as Record<string, unknown>;
      const lat = Number(o.lat), lng = Number(o.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
    }
  }
  return out;
}

/** Normaliza a array de anillos. Acepta un anillo suelto [{lat,lng}…] o varios [[…],[…]]. */
function toRings(raw: unknown): LatLng[][] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (Array.isArray(raw[0])) {
    return (raw as unknown[]).map(toLatLngArray).filter((r) => r.length >= 3);
  }
  const single = toLatLngArray(raw);
  return single.length >= 3 ? [single] : [];
}

export function parseDeliveryConfig(raw: unknown): DeliveryConfig {
  const d = defaultDeliveryConfig();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const originLat = Number((o.origin as Record<string, unknown>)?.lat);
  const originLng = Number((o.origin as Record<string, unknown>)?.lng);
  return {
    mode: o.mode === "distance" ? "distance" : "zones",
    origin: Number.isFinite(originLat) && Number.isFinite(originLng) ? { lat: originLat, lng: originLng } : null,
    originAddress: o.originAddress ? String(o.originAddress) : null,
    basePrice: Math.max(0, Math.round(Number(o.basePrice) || 0)),
    pricePerKm: Math.max(0, Math.round(Number(o.pricePerKm) || 0)),
    roundingMult: Math.max(1, Math.round(Number(o.roundingMult) || 100)),
    polygonIncluded: toLatLngArray(o.polygonIncluded),
    polygonExcluded: toRings(o.polygonExcluded),
  };
}

/** Ray-casting: ¿el punto está dentro del polígono? */
export function pointInPolygon(pt: LatLng, polygon: LatLng[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].lat, xi = polygon[i].lng;
    const yj = polygon[j].lat, xj = polygon[j].lng;
    if ((yi > pt.lat) !== (yj > pt.lat) && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distancia haversine en km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function roundToNearest(value: number, mult: number): number {
  const m = Math.max(1, Math.abs(mult || 100));
  return Math.round(value / m) * m;
}

export interface DistanceFeeResult {
  available: boolean;
  fee: number;
  distanceKm: number;
  reason?: string;
}

/** Calcula la tarifa de delivery por distancia+polígono para un destino. */
export function computeDistanceFee(config: DeliveryConfig, dest: LatLng): DistanceFeeResult {
  if (!config.origin) return { available: false, fee: 0, distanceKm: 0, reason: "El local aún no configuró su ubicación." };
  if (config.polygonExcluded.some((ring) => ring.length >= 3 && pointInPolygon(dest, ring))) {
    return { available: false, fee: 0, distanceKm: 0, reason: "No llegamos a esa dirección (zona excluida)." };
  }
  if (config.polygonIncluded.length >= 3 && !pointInPolygon(dest, config.polygonIncluded)) {
    return { available: false, fee: 0, distanceKm: 0, reason: "La dirección está fuera del perímetro de reparto." };
  }
  const distanceKm = haversineKm(config.origin, dest);
  const fee = roundToNearest(config.basePrice + distanceKm * config.pricePerKm, config.roundingMult);
  return { available: true, fee, distanceKm };
}
