// ═══════════════════════════════════════════════════════════
//  Uber Direct — courier bajo demanda para el Ecommerce.
//  Credenciales por restaurante desde ecommerceConfig.uberDirect.
//  Flujo: OAuth (client_credentials) → crear entrega → webhooks de estado.
// ═══════════════════════════════════════════════════════════
import { parseEcommerceConfig } from "@/lib/ecommerce/config";

const LOGIN_URL = "https://login.uber.com/oauth/v2/token";
const API_BASE = "https://api.uber.com/v1";

export interface UberCreds {
  customerId?: string;
  clientId?: string;
  clientSecret?: string;
  signingKey?: string;
}

export function uberSettingsFor(restaurant: { ecommerceConfig?: unknown } | null): UberCreds {
  const u = parseEcommerceConfig(restaurant?.ecommerceConfig).uberDirect || {};
  return { customerId: u.customerId, clientId: u.clientId, clientSecret: u.clientSecret, signingKey: u.signingKey };
}

export function uberConfigured(creds: UberCreds): boolean {
  return !!(creds.customerId && creds.clientId && creds.clientSecret);
}

/** OAuth client_credentials → access token. */
export async function uberToken(creds: UberCreds): Promise<string | null> {
  if (!creds.clientId || !creds.clientSecret) return null;
  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        grant_type: "client_credentials",
        scope: "eats.deliveries",
      }).toString(),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    return (data as { access_token?: string }).access_token || null;
  } catch {
    return null;
  }
}

// ── Estado del courier normalizado a nuestro pedido ──────────
export type UberStatus = "pending" | "pickup" | "pickup_complete" | "dropoff" | "delivered" | "canceled" | "returned" | string;

export interface CourierInfo {
  deliveryId: string;
  status: UberStatus;
  trackingUrl: string | null;
  fee: number | null; // CLP
  eta: string | null; // ISO dropoff_eta
  courierName: string | null;
  courierPhone: string | null;
  courierVehicle: string | null;
  courierImg: string | null;
  location: { lat: number; lng: number } | null;
  proofPhotoUrl: string | null; // data URI cuando entregó
  updatedAt: string;
}

/** Extrae la info relevante del objeto delivery de Uber. */
export function parseDelivery(d: Record<string, unknown>, prev?: Partial<CourierInfo>): CourierInfo {
  const courier = (d.courier as Record<string, unknown>) || {};
  const loc = (courier.location as { lat?: number; lng?: number }) || {};
  return {
    deliveryId: String(d.id ?? prev?.deliveryId ?? ""),
    status: (d.status as string) ?? prev?.status ?? "pending",
    trackingUrl: (d.tracking_url as string) ?? prev?.trackingUrl ?? null,
    fee: typeof d.fee === "number" ? Math.round((d.fee as number) / 100) : prev?.fee ?? null, // Uber envía en centavos
    eta: (d.dropoff_eta as string) ?? prev?.eta ?? null,
    courierName: (courier.name as string) ?? prev?.courierName ?? null,
    courierPhone: (courier.phone_number as string) ?? prev?.courierPhone ?? null,
    courierVehicle: (courier.vehicle_type as string) ?? prev?.courierVehicle ?? null,
    courierImg: (courier.img_href as string) ?? prev?.courierImg ?? null,
    location: (loc.lat != null && loc.lng != null) ? { lat: loc.lat, lng: loc.lng } : prev?.location ?? null,
    proofPhotoUrl: prev?.proofPhotoUrl ?? null,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Mapea el estado de Uber a un status de pedido nuestro.
 * - pickup_complete / dropoff → IN_DELIVERY (repartidor en camino al cliente)
 * - delivered → DONE
 * Los demás (pending/pickup) no cambian el status del pedido.
 */
export function uberStatusToOrder(status: UberStatus): "IN_DELIVERY" | "DONE" | null {
  if (status === "delivered") return "DONE";
  if (status === "pickup_complete" || status === "dropoff") return "IN_DELIVERY";
  return null;
}

export interface CreateDeliveryParams {
  pickupName: string;
  pickupAddress: string;
  pickupPhone: string;
  dropoffName: string;
  dropoffAddress: string;
  dropoffPhone: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffNotes?: string | null;
  manifestItems: { name: string; quantity: number }[];
  manifestTotalValue: number; // CLP
  externalId: string;
}

export interface CreateDeliveryResult {
  ok: boolean;
  delivery?: CourierInfo;
  error?: string;
  raw?: unknown;
}

/** Crea una entrega en Uber Direct. */
export async function uberCreateDelivery(creds: UberCreds, params: CreateDeliveryParams): Promise<CreateDeliveryResult> {
  if (!uberConfigured(creds)) return { ok: false, error: "Uber Direct no configurado" };
  const token = await uberToken(creds);
  if (!token) return { ok: false, error: "No se pudo autenticar con Uber" };

  const body: Record<string, unknown> = {
    pickup_name: params.pickupName,
    pickup_address: params.pickupAddress,
    pickup_phone_number: params.pickupPhone,
    dropoff_name: params.dropoffName,
    dropoff_address: params.dropoffAddress,
    dropoff_phone_number: params.dropoffPhone,
    manifest_items: params.manifestItems.map((it) => ({ name: it.name, quantity: it.quantity, size: "small" })),
    manifest_total_value: Math.round(params.manifestTotalValue * 100), // centavos
    external_id: params.externalId,
    ...(params.dropoffNotes ? { dropoff_notes: params.dropoffNotes.slice(0, 280) } : {}),
    ...(params.dropoffLat != null && params.dropoffLng != null ? { dropoff_latitude: params.dropoffLat, dropoff_longitude: params.dropoffLng } : {}),
  };

  try {
    const res = await fetch(`${API_BASE}/customers/${creds.customerId}/deliveries`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok || !(data as { id?: string }).id) {
      const msg = (data as { message?: string; code?: string }).message || (data as { code?: string }).code || `HTTP ${res.status}`;
      return { ok: false, error: msg, raw: data };
    }
    return { ok: true, delivery: parseDelivery(data as Record<string, unknown>), raw: data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error Uber" };
  }
}

/** Consulta una entrega. */
export async function uberGetDelivery(creds: UberCreds, deliveryId: string): Promise<CreateDeliveryResult> {
  const token = await uberToken(creds);
  if (!token) return { ok: false, error: "No se pudo autenticar con Uber" };
  try {
    const res = await fetch(`${API_BASE}/customers/${creds.customerId}/deliveries/${deliveryId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, raw: data };
    return { ok: true, delivery: parseDelivery(data as Record<string, unknown>), raw: data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error Uber" };
  }
}

/** Cancela una entrega. */
export async function uberCancelDelivery(creds: UberCreds, deliveryId: string): Promise<{ ok: boolean; error?: string }> {
  const token = await uberToken(creds);
  if (!token) return { ok: false, error: "No se pudo autenticar con Uber" };
  try {
    const res = await fetch(`${API_BASE}/customers/${creds.customerId}/deliveries/${deliveryId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error Uber" };
  }
}

/** Foto de prueba de entrega (base64 → data URI). Best-effort. */
export async function uberProofOfDelivery(creds: UberCreds, deliveryId: string): Promise<string | null> {
  const token = await uberToken(creds);
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/customers/${creds.customerId}/deliveries/${deliveryId}/proof-of-delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ waypoint: "dropoff", type: "picture" }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    const b64 = (data as { document?: string }).document;
    return b64 ? `data:image/jpeg;base64,${b64}` : null;
  } catch {
    return null;
  }
}
