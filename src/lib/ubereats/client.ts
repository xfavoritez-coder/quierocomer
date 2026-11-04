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
// Endpoints de la Orders API (paths confirmados con la guía de sandbox de Uber).
const EP = {
  getOrder: (id: string) => `${BASE}/v1/delivery/orders/${id}`,
  accept: (id: string) => `${BASE}/v1/delivery/orders/${id}/accept_pos_order`,
  deny: (id: string) => `${BASE}/v1/delivery/orders/${id}/deny_pos_order`,
  cancel: (id: string) => `${BASE}/v1/delivery/orders/${id}/cancel`,
  // Estado de preparación (listo). Path a confirmar con un pedido real del sandbox.
  restaurantStatus: (id: string) => `${BASE}/v1/eats/orders/${id}/restaurant_status`,
};
const SCOPE = "eats.order";

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

/** Rechaza el pedido (cuando el local no puede prepararlo). */
export async function denyUberOrder(orderId: string, reason = "store_closed"): Promise<void> {
  const res = await authed(EP.deny(orderId), { method: "POST", body: JSON.stringify({ reason }) });
  if (!res.ok) throw new Error(`Uber deny ${res.status}: ${await res.text()}`);
}

/** Marca el pedido como listo/finalizado de preparación. */
export async function markUberOrderReady(orderId: string): Promise<void> {
  const res = await authed(EP.restaurantStatus(orderId), {
    method: "POST",
    body: JSON.stringify({ status: "finished" }),
  });
  if (!res.ok) throw new Error(`Uber ready ${res.status}: ${await res.text()}`);
}
