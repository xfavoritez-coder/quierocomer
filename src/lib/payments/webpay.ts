// ═══════════════════════════════════════════════════════════
//  Webpay Plus (Transbank) — integración para el ecommerce
//  Portado del sistema de Servio. En modo "integration" usa las
//  credenciales de prueba que trae el SDK (no requiere config real).
// ═══════════════════════════════════════════════════════════
import { WebpayPlus, Options, IntegrationApiKeys, Environment, IntegrationCommerceCodes } from "transbank-sdk";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";

export interface WebpaySettings {
  webpay_env?: string; // "production" | "integration" (default: integration)
  webpay_commerce_code?: string; // solo producción
  webpay_api_key?: string; // solo producción
}

export interface WebpayInitResult {
  ok: boolean;
  url?: string;
  token?: string;
  error?: string;
}

export interface WebpayConfirmResult {
  ok: boolean;
  authorized: boolean;
  amount?: number;
  transactionId?: string;
  responseCode?: number;
  status?: string;
  reason?: string;
  raw?: unknown;
  error?: string;
}

/**
 * Traduce el response_code de Transbank a un motivo legible.
 * 0 = aprobado; negativos = rechazos del emisor/pasarela (no es que "la pasarela
 * falle": casi siempre es el banco/tarjeta del cliente quien rechaza).
 */
export function webpayReason(code: number | null | undefined): string {
  switch (code) {
    case 0: return "Aprobado";
    case -1: return "Rechazo del emisor (posible error de datos de la tarjeta)";
    case -2: return "Rechazo — reintentar (fondos/validación del banco)";
    case -3: return "Error en la transacción";
    case -4: return "Rechazada por el banco emisor";
    case -5: return "Rechazo por posible fraude / validación de riesgo";
    case -6: return "Excede el cupo máximo mensual";
    case -7: return "Excede el límite diario por transacción";
    case -8: return "Rubro no autorizado";
    default: return code == null ? "Sin código de respuesta" : `Rechazo (código ${code})`;
  }
}

function getTransaction(settings: WebpaySettings) {
  const isProd = settings.webpay_env === "production";
  const env = isProd ? Environment.Production : Environment.Integration;
  const code = isProd ? (settings.webpay_commerce_code || "") : IntegrationCommerceCodes.WEBPAY_PLUS;
  const key = isProd ? (settings.webpay_api_key || "") : IntegrationApiKeys.WEBPAY;
  return new WebpayPlus.Transaction(new Options(code, key, env));
}

/** Crea la transacción y devuelve la URL + token para redirigir al formulario de Webpay. */
export async function webpayInit(
  buyOrder: string,
  sessionId: string,
  amount: number,
  returnUrl: string,
  settings: WebpaySettings = {},
): Promise<WebpayInitResult> {
  try {
    const tx = getTransaction(settings);
    const res = await tx.create(buyOrder, sessionId, amount, returnUrl);
    return { ok: true, url: res.url, token: res.token };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Error Webpay" };
  }
}

/** Confirma (commit) la transacción al volver de Webpay. */
export async function webpayConfirm(token: string, settings: WebpaySettings = {}): Promise<WebpayConfirmResult> {
  try {
    const tx = getTransaction(settings);
    const res = await tx.commit(token);
    const authorized = res.response_code === 0 && ["AUTHORIZED", "CAPTURED"].includes(res.status ?? "");
    const reason = webpayReason(res.response_code);
    // Log de diagnóstico del commit: distingue rechazo del banco vs. aprobado.
    const card = (res as { card_detail?: { card_number?: string } }).card_detail?.card_number;
    console.log("[webpay] commit", JSON.stringify({
      buyOrder: res.buy_order,
      authorized,
      responseCode: res.response_code,
      status: res.status,
      reason,
      amount: res.amount,
      paymentType: (res as { payment_type_code?: string }).payment_type_code,
      installments: (res as { installments_number?: number }).installments_number,
      vci: (res as { vci?: string }).vci,
      cardLast4: card,
      authorizationCode: res.authorization_code,
      transactionDate: (res as { transaction_date?: string }).transaction_date,
    }));
    return {
      ok: true,
      authorized,
      amount: res.amount,
      transactionId: res.authorization_code ?? res.buy_order,
      responseCode: res.response_code,
      status: res.status ?? undefined,
      reason,
      raw: res,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error Webpay";
    console.error("[webpay] commit ERROR", JSON.stringify({ error: msg }));
    return { ok: false, authorized: false, error: msg };
  }
}

export interface WebpayRefundResult { ok: boolean; type?: string; error?: string; raw?: unknown }

/**
 * Reembolsa (anula/reversa) una transacción Webpay por un monto. Si el monto es
 * igual al total, Transbank hace anulación total; si es menor, reembolso parcial.
 * El token es el mismo de la transacción confirmada.
 */
export async function webpayRefund(token: string, amount: number, settings: WebpaySettings = {}): Promise<WebpayRefundResult> {
  try {
    const tx = getTransaction(settings);
    const res = await tx.refund(token, amount);
    const type = (res as { type?: string }).type;
    console.log("[webpay] refund", JSON.stringify({ amount, type, raw: res }));
    // La respuesta trae `type` (REVERSED / NULLIFIED). Cualquiera indica éxito.
    return { ok: !!type, type, raw: res };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error Webpay";
    console.error("[webpay] refund ERROR", JSON.stringify({ error: msg }));
    return { ok: false, error: msg };
  }
}

/**
 * Lee la config Webpay del restaurante desde Restaurant.ecommerceConfig.
 * Si hay credenciales de producción completas, usa producción; si no,
 * cae a modo integración (credenciales de prueba del SDK).
 */
export function webpaySettingsFor(restaurant: { ecommerceConfig?: unknown } | null): WebpaySettings {
  const w = parseEcommerceConfig(restaurant?.ecommerceConfig).webpay;
  if (w?.env === "production" && w.commerceCode && w.apiKey) {
    return { webpay_env: "production", webpay_commerce_code: w.commerceCode, webpay_api_key: w.apiKey };
  }
  return { webpay_env: "integration" };
}
