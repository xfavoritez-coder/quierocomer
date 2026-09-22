// ═══════════════════════════════════════════════════════════
//  Cliente de PedidosYa Courier (envíos por API). Portado del
//  PHP de deliveryhandroll (pya_*.php). Auth = token crudo en el
//  header Authorization (NO bearer). Base courier-api.pedidosya.com.
// ═══════════════════════════════════════════════════════════

export interface PyaCreds {
  apiToken: string;
  base: string;
  isTest: boolean;
  webhookSecret: string;
  store: { name: string; phone: string; address: string; city?: string; lat?: number | null; lng?: number | null };
}

const DEFAULT_BASE = "https://courier-api.pedidosya.com";

/** Lee las credenciales de PedidosYa del ecommerceConfig del local. */
export function pyaSettingsFor(restaurant: { ecommerceConfig?: unknown; name?: string; address?: string | null; phone?: string | null; whatsapp?: string | null } | null): PyaCreds {
  const cfg = (restaurant?.ecommerceConfig && typeof restaurant.ecommerceConfig === "object" ? (restaurant.ecommerceConfig as any) : {}) || {};
  const p = cfg.pedidosya || {};
  const s = p.store || {};
  return {
    apiToken: (p.apiToken || "").toString(),
    base: (p.base || DEFAULT_BASE).toString().replace(/\/$/, ""),
    isTest: p.isTest === true,
    webhookSecret: (p.webhookSecret || "").toString(),
    store: {
      name: (s.name || restaurant?.name || "").toString(),
      phone: (s.phone || restaurant?.phone || restaurant?.whatsapp || "").toString(),
      address: (s.address || restaurant?.address || "").toString(),
      city: s.city ? String(s.city) : undefined,
      lat: s.lat != null ? Number(s.lat) : null,
      lng: s.lng != null ? Number(s.lng) : null,
    },
  };
}

export function pyaConfigured(creds: PyaCreds): boolean {
  return !!creds.apiToken && !!creds.store.address && !!creds.store.phone;
}

export interface PyaCourier {
  provider: "pya";
  deliveryId: string; // shippingId
  status: string;
  trackingUrl: string | null;
  confirmationCode: string | null;
  fee: number | null;
  courierName: string | null;
  courierPhone: string | null;
  location: { lat: number; lng: number } | null;
  updatedAt: string;
}

function waypoint(type: "PICK_UP" | "DROP_OFF", name: string, phone: string, address: string, city?: string, lat?: number | null, lng?: number | null, notes?: string) {
  const wp: any = { type, addressStreet: address, contact: { name, phone } };
  if (city) wp.city = city;
  if (lat != null && lng != null) { wp.latitude = lat; wp.longitude = lng; }
  if (notes) wp.notes = notes;
  return wp;
}

export interface PyaCreateParams {
  referenceId: string;
  totalValue: number;
  description: string;
  dropoffName: string; dropoffPhone: string; dropoffAddress: string; dropoffCity?: string; dropoffLat?: number | null; dropoffLng?: number | null; dropoffNotes?: string;
}

/** POST /v3/shippings → crea el envío. */
export async function pyaCreateShipping(creds: PyaCreds, params: PyaCreateParams): Promise<{ ok: boolean; courier?: PyaCourier; error?: string }> {
  if (!pyaConfigured(creds)) return { ok: false, error: "PedidosYa no está configurado para este local" };
  const body = {
    referenceId: params.referenceId,
    isTest: creds.isTest,
    items: [{ value: Math.round(params.totalValue), quantity: 1, weight: 0.5, volume: 1000, description: params.description.slice(0, 120) || "Pedido", type: "STANDARD" }],
    waypoints: [
      waypoint("PICK_UP", creds.store.name, creds.store.phone, creds.store.address, creds.store.city, creds.store.lat, creds.store.lng),
      waypoint("DROP_OFF", params.dropoffName, params.dropoffPhone, params.dropoffAddress, params.dropoffCity, params.dropoffLat, params.dropoffLng, params.dropoffNotes),
    ],
  };
  try {
    const res = await fetch(`${creds.base}/v3/shippings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: creds.apiToken },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as any)?.message || `PedidosYa respondió ${res.status}` };
    const d = data as any;
    const id = String(d.id ?? d.shippingId ?? "");
    if (!id) return { ok: false, error: "PedidosYa no devolvió un id de envío" };
    return {
      ok: true,
      courier: {
        provider: "pya", deliveryId: id, status: String(d.status ?? "CONFIRMED"),
        trackingUrl: d.shareLocationUrl ?? d.trackingUrl ?? null, confirmationCode: d.confirmationCode ?? null,
        fee: d.fee != null ? Math.round(Number(d.fee)) : null, courierName: null, courierPhone: null, location: null, updatedAt: new Date().toISOString(),
      },
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error de conexión con PedidosYa" };
  }
}

/** POST /v3/shippings/{id}/cancel */
export async function pyaCancelShipping(creds: PyaCreds, shippingId: string, reason = "Cancelado por el local"): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${creds.base}/v3/shippings/${encodeURIComponent(shippingId)}/cancel`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: creds.apiToken }, body: JSON.stringify({ reasonText: reason }),
    });
    if (res.ok || res.status === 404) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: (data as any)?.message || `PedidosYa respondió ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error de conexión" };
  }
}

/** Estado PedidosYa → etapa operativa del PosOrder. */
export function pyaStatusToOps(status: string): "out_for_delivery" | "delivered" | "canceled" | null {
  const s = (status || "").toUpperCase();
  if (s === "PICKED_UP" || s === "NEAR_DROPOFF") return "out_for_delivery";
  if (s === "COMPLETED" || s === "DELIVERED") return "delivered";
  if (s === "CANCELLED" || s === "CANCELED" || s === "EXPIRED") return "canceled";
  return null; // CONFIRMED | IN_PROGRESS | NEAR_PICKUP → sin cambio de etapa
}
