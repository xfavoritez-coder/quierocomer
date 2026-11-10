// ═══════════════════════════════════════════════════════════
//  Cliente de la integración directa con Uber Eats (Marketplace
//  / Orders API). Recibe los pedidos por webhook y los trae al POS
//  sin pasar por Toteat.
//
//  Flujo (Uber Orders API):
//    webhook orders.notification → getOrder → acceptOrder →
//    (al marcar "Listo" en el POS) markReady.
//
//  ⚠️ ACCESO: requiere una app aprobada en developer.uber.com
//  (partner) y la tienda vinculada. Los paths/scopes exactos de la
//  API varían por versión y se confirman con la documentación del
//  partner / sandbox al activar — están centralizados en EP abajo.
// ═══════════════════════════════════════════════════════════
// Credenciales de la app de integración (globales por env, una sola para toda la
// plataforma). Cada local solo aporta su storeId en su config.
function appCreds(): { clientId: string; clientSecret: string } {
  return { clientId: process.env.UBEREATS_CLIENT_ID || "", clientSecret: process.env.UBEREATS_CLIENT_SECRET || "" };
}
export function uberAppConfigured(): boolean {
  const c = appCreds();
  return !!(c.clientId && c.clientSecret);
}

// Hosts por entorno. Sandbox (default mientras no esté en prod) usa test-api y
// sandbox-login; en producción, api.uber.com y login.uber.com.
const SANDBOX = (process.env.UBEREATS_ENV || "sandbox").toLowerCase() !== "production";
const BASE = SANDBOX ? "https://test-api.uber.com" : "https://api.uber.com";
const TOKEN_URL = SANDBOX ? "https://sandbox-login.uber.com/oauth/v2/token" : "https://login.uber.com/oauth/v2/token";
// Endpoints de la Order API de Eats Marketplace. Paths VERIFICADOS empíricamente
// contra test-api.uber.com (2026-11-10): hay mezcla de versiones. OJO: los paths
// `/v1/delivery/orders/...` de la guía de sandbox dan 404 (son del suite Delivery
// BYOC, no del de Eats). getOrder es v2 singular; las acciones son v1 plural.
const EP = {
  getOrder: (id: string) => `${BASE}/v2/eats/order/${id}`,
  accept: (id: string) => `${BASE}/v1/eats/orders/${id}/accept_pos_order`,
  deny: (id: string) => `${BASE}/v1/eats/orders/${id}/deny_pos_order`,
  cancel: (id: string) => `${BASE}/v1/eats/orders/${id}/cancel`,
  cart: (id: string) => `${BASE}/v2/eats/orders/${id}/cart`,
  // "Listo"/estado de reparto. Requiere scope extra `eats.store.orders.restaurant_delivery`
  // (no incluido en SCOPE abajo) → markReady fallará con 401 hasta agregarlo; no
  // bloquea recibir/aceptar el pedido en la verificación.
  restaurantStatus: (id: string) => `${BASE}/v1/eats/orders/${id}/restaurantdelivery/status`,
  storeStatus: (storeId: string) => `${BASE}/v1/eats/store/${storeId}/status`,
};
// Scopes del token. getOrder (v2) y accept/deny (v1) funcionan con `eats.store eats.order`
// (verificado en sandbox). Las ESCRITURAS necesitan scopes extra que Uber concede recién
// en producción: store toggle → eats.store.status.write; mark-ready → eats.store.orders
// .restaurant_delivery; etc. OJO: pedir un scope NO concedido rompe TODO el token
// (400 invalid_scope), así que el default es el mínimo y en prod se amplía por env
// UBEREATS_SCOPES (p. ej. "eats.store eats.order eats.store.status.write ...").
const SCOPE = process.env.UBEREATS_SCOPES || "eats.store eats.order";

// Token OAuth cacheado (client_credentials de la app global).
let cachedToken: { token: string; exp: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.token;
  const c = appCreds();
  const body = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: "client_credentials",
    scope: SCOPE,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Uber token ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 2592000) * 1000 };
  return j.access_token;
}

async function authed(url: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
}

/** Detalle completo del pedido (el webhook solo trae ids). */
export async function getUberOrder(orderId: string): Promise<Record<string, unknown>> {
  const res = await authed(EP.getOrder(orderId));
  if (!res.ok) throw new Error(`Uber getOrder ${res.status}: ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Acepta el pedido (hay una ventana de tiempo para hacerlo). */
export async function acceptUberOrder(orderId: string, prepTimeMin = 15): Promise<void> {
  const res = await authed(EP.accept(orderId), {
    method: "POST",
    body: JSON.stringify({ reason: "POS accepted", estimated_ready_for_pickup_at_seconds: prepTimeMin * 60 }),
  });
  if (!res.ok) throw new Error(`Uber accept ${res.status}: ${await res.text()}`);
}

// Motivos de rechazo enumerados (Uber espera un código, no texto libre). Mapa
// código → etiqueta en español para la UI del POS.
export const UBER_DENY_REASONS: Record<string, string> = {
  STORE_CLOSED: "Local cerrado",
  POS_NOT_READY: "POS no disponible",
  KITCHEN_BUSY: "Cocina saturada",
  ITEM_OUT_OF_STOCK: "Producto agotado",
  OUT_OF_DELIVERY_RANGE: "Fuera del rango de reparto",
  PRICING_MISMATCH: "Diferencia de precios",
  OTHER: "Otro",
};
export type UberDenyReason = keyof typeof UBER_DENY_REASONS;

/** Rechaza el pedido con un código de motivo enumerado (no texto libre). */
export async function denyUberOrder(orderId: string, reason: UberDenyReason = "STORE_CLOSED"): Promise<void> {
  const code = UBER_DENY_REASONS[reason] ? reason : "OTHER";
  const res = await authed(EP.deny(orderId), { method: "POST", body: JSON.stringify({ reason: code }) });
  if (!res.ok) throw new Error(`Uber deny ${res.status}: ${await res.text()}`);
}

/** Cancela un pedido YA aceptado. ⚠️ Requiere scope propio (solo prod); en sandbox 401. */
export async function cancelUberOrder(orderId: string, reason: UberDenyReason = "OTHER"): Promise<{ ok: boolean; status: number; body: string }> {
  const code = UBER_DENY_REASONS[reason] ? reason : "OTHER";
  const res = await authed(EP.cancel(orderId), { method: "POST", body: JSON.stringify({ reason: code }) });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

/** Actualiza el carrito del pedido: mecanismo de resolución de *fulfillment issues*
 *  (ítem agotado/sustitución). Uber responde el webhook order.fulfillment_issues
 *  .resolved. Path verificado (`/v2/eats/orders/{id}/cart`). ⚠️ puede requerir scope. */
export async function updateUberOrderCart(orderId: string, cart: unknown): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await authed(EP.cart(orderId), { method: "PATCH", body: JSON.stringify(cart) });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

/** Marca el pedido como listo/finalizado de preparación. */
export async function markUberOrderReady(orderId: string): Promise<void> {
  const res = await authed(EP.restaurantStatus(orderId), {
    method: "POST",
    body: JSON.stringify({ status: "finished" }),
  });
  if (!res.ok) throw new Error(`Uber ready ${res.status}: ${await res.text()}`);
}

// ── Menu API (v2) ────────────────────────────────────────────────
// Sube el menú COMPLETO de la tienda. Verificado en sandbox: PUT devuelve 204 y
// el procesamiento es asíncrono. Body = { menus, categories, items, modifier_groups }.
export async function putStoreMenu(storeId: string, menu: unknown): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await authed(`${BASE}/v2/eats/stores/${storeId}/menus`, { method: "PUT", body: JSON.stringify(menu) });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

/** Lee el menú vigente de la tienda en Uber (para verificar la sincronización). */
export async function getStoreMenu(storeId: string): Promise<Record<string, unknown>> {
  const res = await authed(`${BASE}/v2/eats/stores/${storeId}/menus`);
  if (!res.ok) throw new Error(`Uber getMenu ${res.status}: ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>;
}

// ── Store status (online/offline) ────────────────────────────────
// El operador puede pausar/reactivar la tienda en Uber desde el POS.
export type UberStoreStatus = "ONLINE" | "PAUSED" | "OFFLINE";

/** Lee el estado actual de la tienda en Uber (funciona con eats.store). */
export async function getStoreStatus(storeId: string): Promise<string | null> {
  const res = await authed(EP.storeStatus(storeId));
  if (!res.ok) return null;
  const j = (await res.json().catch(() => ({}))) as { status?: string };
  return j.status ?? null;
}

/** Cambia el estado de la tienda en Uber. ⚠️ Requiere scope `eats.store.status.write`
 *  (solo en producción); en sandbox devuelve 401. */
export async function setStoreStatus(storeId: string, status: UberStoreStatus): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await authed(EP.storeStatus(storeId), { method: "POST", body: JSON.stringify({ status }) });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}
