// ═══════════════════════════════════════════════════════════
//  Sincronización de estado + ubicación del repartidor desde
//  deliveryhandroll.cl. Solo para locales habilitados por el
//  superadmin (ecommerceConfig.deliveryHandroll).
//  DH identifica el pedido por: vname (= "QC-"+vendorName) + oref
//  (N° de pedido) + eid (id de Toteat). No requiere token propio.
// ═══════════════════════════════════════════════════════════
import { parseEcommerceConfig } from "./config";

export interface DhDelivery {
  public_status_code?: string; // received|preparing|ready|on_the_way|completed|cancelled
  public_status_label?: string;
  assigned_to?: string; // repartidor asignado
  last_lat?: number | null; // ubicación EN VIVO del repartidor
  last_lng?: number | null;
  customer_lat?: number | null;
  customer_lng?: number | null;
  [k: string]: unknown;
}

// public_status_code de DH → estado interno de OnlineOrder.
export const DH_TO_ORDER_STATUS: Record<string, string> = {
  received: "ACCEPTED",
  preparing: "PREPARING",
  ready: "READY",
  on_the_way: "IN_DELIVERY",
  completed: "DONE",
  cancelled: "CANCELLED",
};

// Etiquetas en español para los estados que devuelve deliveryhandroll (evita
// mostrar anglicismos/códigos crudos como "on_the_way" en el panel y al cliente).
export const DH_STATUS_LABEL_ES: Record<string, string> = {
  received: "Pedido recibido",
  preparing: "En preparación",
  ready: "Listo para entregar",
  ready_for_delivery: "Listo para entregar",
  assigned: "Repartidor asignado",
  accepted: "Repartidor asignado",
  picked_up: "Pedido retirado",
  pickup: "Repartidor en el local",
  on_the_way: "En camino al cliente",
  in_delivery: "En camino al cliente",
  completed: "Entregado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  canceled: "Cancelado",
};

/** Etiqueta en español para un public_status_code de DH. Si es desconocido, lo
 *  "prettifica" (snake_case → "Snake case"). null si no hay código. */
export function dhStatusLabelEs(code?: string | null): string | null {
  if (!code) return null;
  const key = String(code).toLowerCase();
  if (DH_STATUS_LABEL_ES[key]) return DH_STATUS_LABEL_ES[key];
  const pretty = key.replace(/[_-]+/g, " ").trim();
  return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : null;
}

/** vname que espera DH para un local: "QC-" + vendorName. */
export function dhVendorName(vendorName: string): string {
  return `QC-${vendorName.trim()}`;
}

/** Devuelve el vendorName si el local tiene la integración habilitada; null si no. */
export function deliveryHandrollVendor(ecommerceConfig: unknown): string | null {
  const dh = parseEcommerceConfig(ecommerceConfig).deliveryHandroll;
  if (dh?.enabled && dh.vendorName && dh.vendorName.trim()) return dh.vendorName.trim();
  return null;
}

/** Consulta estado + ubicación del repartidor en deliveryhandroll. null si no está o falla. */
export async function fetchDhTracking(opts: { vendorName: string; orderNumber?: number | null; toteatOrderId?: string | null }): Promise<DhDelivery | null> {
  try {
    const params = new URLSearchParams();
    params.set("vname", dhVendorName(opts.vendorName));
    if (opts.orderNumber != null) params.set("oref", String(opts.orderNumber));
    if (opts.toteatOrderId) params.set("eid", String(opts.toteatOrderId));
    const url = `https://deliveryhandroll.cl/delivery/api/track_by_servio_token.php?${params}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4500) });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    if (!json?.ok) return null;
    return (json.delivery ?? null) as DhDelivery | null;
  } catch {
    return null;
  }
}

/** Mapea el estado de DH al estado interno; null si no hay estado. */
export function mapDhStatus(d: DhDelivery | null): string | null {
  if (!d?.public_status_code) return null;
  return DH_TO_ORDER_STATUS[d.public_status_code as string] ?? null;
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Info del repartidor normalizada para persistir en OnlineOrder.courier / mostrar al cliente.
 *  Devuelve null si aún NO hay repartidor real (sin nombre asignado y sin ubicación válida);
 *  así no se muestra "Repartidor asignado" cuando DH solo reporta el estado de preparación. */
export function dhCourier(d: DhDelivery | null): { lat: number | null; lng: number | null; name: string | null; label: string | null } | null {
  if (!d) return null;
  let lat = num(d.last_lat);
  let lng = num(d.last_lng);
  // (0,0) o valores inválidos = todavía sin ubicación real del repartidor.
  if (!(lat != null && lng != null && (Math.abs(lat) > 0.01 || Math.abs(lng) > 0.01))) { lat = null; lng = null; }
  const name = typeof d.assigned_to === "string" && d.assigned_to.trim() ? d.assigned_to.trim() : null;
  const label = typeof d.public_status_label === "string" ? d.public_status_label : null;
  if (lat == null && lng == null && !name) return null; // sin repartidor todavía
  return { lat, lng, name, label };
}

/** Coordenada válida: no nula y no el (0,0) que DH devuelve cuando aún no hay ubicación real. */
function validCoord(lat: number | null, lng: number | null): boolean {
  return lat != null && lng != null && (Math.abs(lat) > 0.01 || Math.abs(lng) > 0.01);
}

/**
 * Registro que se guarda en OnlineOrder.courier para un repartidor de deliveryhandroll.
 * Comparte forma con el courier de Uber Direct pero se marca con source="deliveryhandroll"
 * para que el panel lo muestre con su nombre/estado real y NO como "Repartidor Uber".
 */
export function dhCourierRecord(
  track: DhDelivery | null,
  courier: { lat: number | null; lng: number | null; name: string | null; label: string | null },
  prev: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...prev,
    source: "deliveryhandroll",
    status: track?.public_status_code ?? null,
    statusLabel: dhStatusLabelEs(track?.public_status_code) || courier.label,
    courierName: courier.name,
    location: validCoord(courier.lat, courier.lng) ? { lat: courier.lat, lng: courier.lng } : null,
    lat: courier.lat,
    lng: courier.lng,
    name: courier.name,
    label: courier.label,
    updatedAt: new Date().toISOString(),
  };
}
