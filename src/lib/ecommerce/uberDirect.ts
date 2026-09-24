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
  eta: string | null; // ISO dropoff_eta (llega a casa del cliente)
  pickupEta: string | null; // ISO pickup_eta (llega al local)
  courierName: string | null;
  courierPhone: string | null;
  courierVehicle: string | null;
  courierImg: string | null;
  location: { lat: number; lng: number } | null;
  dropoffPin: string | null; // código que el cliente da al repartidor (respaldo)
  pickupPin: string | null; // código para entregar el pedido al repartidor en el local
  proofPhotoUrl: string | null; // data URI cuando entregó
  updatedAt: string;
}

/** Normaliza un teléfono a E.164 chileno (Uber lo exige). */
export function uberPhone(phone: string): string {
  const p = (phone || "").trim();
  if (!p) return "";
  if (p[0] === "+") return p;
  const digits = p.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("56")) return "+" + digits;
  return "+56" + digits.replace(/^0+/, "");
}

/** Dirección estructurada (string JSON) que espera Uber Direct. */
export function uberAddress(street: string, city: string): string {
  return JSON.stringify({
    street_address: [street],
    city: city || "Santiago",
    state: "Región Metropolitana",
    zip_code: "",
    country: "CL",
  });
}

function firstStr(...vals: unknown[]): string | null {
  for (const v of vals) { if (typeof v === "string" && v.trim()) return v; }
  return null;
}

/** Extrae la info relevante del objeto delivery de Uber. */
export function parseDelivery(d: Record<string, unknown>, prev?: Partial<CourierInfo>): CourierInfo {
  const courier = (d.courier as Record<string, unknown>) || {};
  const loc = (courier.location as { lat?: number; lng?: number }) || {};
  const pickup = (d.pickup as Record<string, any>) || {};
  const dropoff = (d.dropoff as Record<string, any>) || {};
  // El PIN del cliente (dropoff pincode) puede venir en varias rutas según el evento.
  const dropoffPin = firstStr(
    (d as any).verification_requirements?.pincode?.value,
    (d as any).dropoff_verification?.pincode?.value,
    dropoff?.verification?.pincode?.value,
    dropoff?.verification_requirements?.pincode?.value,
  );
  const pickupPin = firstStr(
    (d as any).pickup_verification?.pincode?.value,
    pickup?.verification?.pincode?.value,
    pickup?.verification_requirements?.pincode?.value,
  );
  return {
    deliveryId: String(d.id ?? prev?.deliveryId ?? ""),
    status: (d.status as string) ?? prev?.status ?? "pending",
    trackingUrl: (d.tracking_url as string) ?? prev?.trackingUrl ?? null,
    fee: typeof d.fee === "number" ? Math.round((d.fee as number) / 100) : prev?.fee ?? null, // Uber envía en centavos
    eta: (d.dropoff_eta as string) ?? prev?.eta ?? null,
    pickupEta: (d.pickup_eta as string) ?? prev?.pickupEta ?? null,
    courierName: (courier.name as string) ?? (courier.first_name as string) ?? prev?.courierName ?? null,
    courierPhone: (courier.phone_number as string) ?? ((courier.public_phone_info as any)?.formatted_phone_number as string) ?? prev?.courierPhone ?? null,
    courierVehicle: (courier.vehicle_type as string) ?? prev?.courierVehicle ?? null,
    courierImg: (courier.img_href as string) ?? (courier.image_url as string) ?? prev?.courierImg ?? null,
    location: (loc.lat != null && loc.lng != null) ? { lat: loc.lat, lng: loc.lng } : prev?.location ?? null,
    dropoffPin: dropoffPin ?? prev?.dropoffPin ?? null,
    pickupPin: pickupPin ?? prev?.pickupPin ?? null,
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
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupCity?: string | null;
  dropoffName: string;
  dropoffAddress: string;
  dropoffPhone: string;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  dropoffCity?: string | null;
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

  const pickupCity = params.pickupCity || "Santiago";
  const dropoffCity = params.dropoffCity || pickupCity;
  const body: Record<string, unknown> = {
    pickup_name: params.pickupName,
    pickup_address: uberAddress(params.pickupAddress, pickupCity), // dirección estructurada (JSON)
    pickup_phone_number: uberPhone(params.pickupPhone),
    dropoff_name: params.dropoffName,
    dropoff_address: uberAddress(params.dropoffAddress, dropoffCity),
    dropoff_phone_number: uberPhone(params.dropoffPhone),
    manifest_items: params.manifestItems.map((it) => ({ name: it.name.slice(0, 60), quantity: it.quantity, size: "small" })),
    // CLP no tiene decimales → se envía el monto en su unidad mínima (peso), no ×100.
    manifest_total_value: Math.max(1, Math.round(params.manifestTotalValue)),
    external_id: params.externalId,
    pickup_ready_dt: new Date().toISOString(),
    // Verificación en la entrega: PIN de 4 dígitos (respaldo del cliente) + foto.
    dropoff_verification: { pincode: { enabled: true }, picture: true },
    ...(params.pickupLat != null && params.pickupLng != null ? { pickup_latitude: params.pickupLat, pickup_longitude: params.pickupLng } : {}),
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
