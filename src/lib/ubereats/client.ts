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
  // "Listo"/estado de reparto. Scope correcto (VERIFICADO 2026-11-20, concedido en
  // sandbox): `eats.store.orders.restaurantdelivery.status` (NO el `..restaurant_delivery`
  // que se asumía antes → daba 400 invalid_scope). ⚠️ Este endpoint es SOLO para
  // pedidos de REPARTO PROPIO del restaurante: en "Delivery by Uber" responde 400
  // "Cannot update status of this order type" (Uber maneja el repartidor) — markReady
  // lo trata como no-op. No existe endpoint de "marcar listo" para Delivery-by-Uber
  // (probados ~13 paths → 404); la hora de preparación se fija al aceptar.
  restaurantStatus: (id: string) => `${BASE}/v1/eats/orders/${id}/restaurantdelivery/status`,
  storeStatus: (storeId: string) => `${BASE}/v1/eats/store/${storeId}/status`,
  posData: (storeId: string) => `${BASE}/v1/eats/stores/${storeId}/pos_data`,
};
// Scopes del token. getOrder (v2) y accept/deny (v1) funcionan con `eats.store eats.order`
// (verificado en sandbox). Scopes de ESCRITURA (nombres VERIFICADOS 2026-11-20):
// mark-ready/reparto propio → `eats.store.orders.restaurantdelivery.status` (SÍ se
// concede en sandbox), store toggle → `eats.store.status.write`, etc. OJO: pedir un
// scope NO concedido rompe TODO el token (400 invalid_scope), así que el default es el
// mínimo y se amplía por env UBEREATS_SCOPES (p. ej. "eats.store eats.order
// eats.store.orders.restaurantdelivery.status"). Para Delivery-by-Uber igual no hay
// "marcar listo", así que ampliar el scope solo sirve para pedidos de reparto propio.
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

/** Acepta el pedido (hay ventana de tiempo). `prepTimeMin` fija el tiempo de
 *  preparación → se envía como `pickup_time` (timestamp Unix en segundos, por doc).
 *  `fields_relayed` DECLARA que el POS transmite las instrucciones especiales y promos
 *  a la cocina (requisito de Uber: solo se rechaza si NO se pueden transmitir; nosotros
 *  SÍ las mostramos en la comanda, así que las relayeamos en vez de rechazar). */
export async function acceptUberOrder(orderId: string, prepTimeMin = 15): Promise<void> {
  const pickupTime = Math.floor(Date.now() / 1000) + prepTimeMin * 60;
  const res = await authed(EP.accept(orderId), {
    method: "POST",
    body: JSON.stringify({
      reason: "POS accepted",
      pickup_time: pickupTime,
      fields_relayed: {
        order_special_instructions: true,
        item_special_instructions: true,
        item_special_requests: true,
        promotions: true,
      },
    }),
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

// Mapeo de NUESTROS motivos (UberDenyReason) al enum REAL de Uber (según la doc
// oficial /docs/eats/references/api, verificado en sandbox 2026-11-20).
// deny_pos_order: reason es OBJETO {code, explanation}. Enum: STORE_CLOSED,
// POS_NOT_READY, POS_OFFLINE, ITEM_AVAILABILITY, MISSING_ITEM, MISSING_INFO,
// PRICING, CAPACITY, ADDRESS, SPECIAL_INSTRUCTIONS, OTHER.
const DENY_CODE_MAP: Record<UberDenyReason, string> = {
  STORE_CLOSED: "STORE_CLOSED", POS_NOT_READY: "POS_NOT_READY", KITCHEN_BUSY: "CAPACITY",
  ITEM_OUT_OF_STOCK: "ITEM_AVAILABILITY", OUT_OF_DELIVERY_RANGE: "ADDRESS",
  PRICING_MISMATCH: "PRICING", OTHER: "OTHER",
};
// cancel (pedido ya aceptado): reason es STRING. Enum: OUT_OF_ITEMS, KITCHEN_CLOSED,
// CUSTOMER_CALLED_TO_CANCEL, RESTAURANT_TOO_BUSY, CANNOT_COMPLETE_CUSTOMER_NOTE, OTHER.
// `details` es OBLIGATORIO cuando reason = OTHER.
const CANCEL_CODE_MAP: Record<UberDenyReason, string> = {
  STORE_CLOSED: "KITCHEN_CLOSED", POS_NOT_READY: "RESTAURANT_TOO_BUSY", KITCHEN_BUSY: "RESTAURANT_TOO_BUSY",
  ITEM_OUT_OF_STOCK: "OUT_OF_ITEMS", OUT_OF_DELIVERY_RANGE: "OTHER",
  PRICING_MISMATCH: "CANNOT_COMPLETE_CUSTOMER_NOTE", OTHER: "OTHER",
};

/** Rechaza un pedido AÚN NO aceptado (deny_pos_order). reason = OBJETO {code, explanation}.
 *  OJO (doc): el deny NO cancela de inmediato si la tienda tiene la app Uber Eats Orders
 *  activa — ahí pueden re-aceptarlo; si no, se cancela a los 11,5 min. */
export async function denyUberOrder(orderId: string, reason: UberDenyReason = "STORE_CLOSED"): Promise<void> {
  const code = DENY_CODE_MAP[reason] || "OTHER";
  const explanation = UBER_DENY_REASONS[reason] || "Rechazado en el POS";
  const res = await authed(EP.deny(orderId), { method: "POST", body: JSON.stringify({ reason: { code, explanation } }) });
  if (!res.ok) throw new Error(`Uber deny ${res.status}: ${await res.text()}`);
}

/** Cancela un pedido YA aceptado. reason = STRING enum (+ `details` si es OTHER). */
export async function cancelUberOrder(orderId: string, reason: UberDenyReason = "OTHER"): Promise<{ ok: boolean; status: number; body: string }> {
  const code = CANCEL_CODE_MAP[reason] || "OTHER";
  const payload: Record<string, unknown> = { reason: code };
  if (code === "OTHER") payload.details = UBER_DENY_REASONS[reason] || "Anulado en el POS";
  const res = await authed(EP.cancel(orderId), { method: "POST", body: JSON.stringify(payload) });
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

/** Marca el pedido como listo/finalizado de preparación (solo reparto propio del
 *  restaurante). En "Delivery by Uber" es no-op (Uber gestiona el repartidor). */
export async function markUberOrderReady(orderId: string): Promise<void> {
  const res = await authed(EP.restaurantStatus(orderId), {
    method: "POST",
    body: JSON.stringify({ status: "finished" }),
  });
  if (res.ok) return;
  const body = await res.text();
  // 400 "Cannot update status of this order type" = pedido Delivery-by-Uber → no-op
  // esperado (no hay "listo" para ese tipo). Solo se reporta un error real.
  if (res.status === 400 && /order type/i.test(body)) return;
  throw new Error(`Uber ready ${res.status}: ${body}`);
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

// ── Integration Configuration (provisioning de la integración POS por tienda) ──
// Ciclo activar/consultar/actualizar/eliminar que exige el estándar de Uber.
// Endpoints verificados en sandbox: GET/POST/DELETE /v1/eats/stores/{id}/pos_data.
// GET funciona con eats.store; POST/DELETE requieren scope `eats.pos_provisioning`
// (solo en producción). pos_data trae: pos_integration_enabled, online_status,
// auto_accept_enabled, order_release_enabled, order_manager_client_id.

/** Consulta la config de integración POS de la tienda. null si no hay acceso. */
export async function getStorePosData(storeId: string): Promise<Record<string, unknown> | null> {
  const res = await authed(EP.posData(storeId));
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
}

/** Activa/actualiza la integración POS de la tienda. ⚠️ Requiere `eats.pos_provisioning`. */
export async function setStorePosIntegration(storeId: string, opts: { enabled: boolean; autoAccept?: boolean; orderManagerClientId?: string }): Promise<{ ok: boolean; status: number; body: string }> {
  const body: Record<string, unknown> = { pos_integration_enabled: opts.enabled };
  if (opts.autoAccept != null) body.auto_accept_enabled = opts.autoAccept;
  if (opts.orderManagerClientId) body.order_manager_client_id = opts.orderManagerClientId;
  const res = await authed(EP.posData(storeId), { method: "POST", body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, body: await res.text() };
}

/** Elimina/desvincula la integración POS de la tienda. ⚠️ Requiere `eats.pos_provisioning`. */
export async function removeStorePosIntegration(storeId: string): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await authed(EP.posData(storeId), { method: "DELETE" });
  return { ok: res.ok, status: res.status, body: await res.text() };
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
