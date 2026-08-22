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
  raw?: unknown;
  error?: string;
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
    return {
      ok: true,
      authorized,
      amount: res.amount,
      transactionId: res.authorization_code ?? res.buy_order,
      raw: res,
    };
  } catch (err: unknown) {
    return { ok: false, authorized: false, error: err instanceof Error ? err.message : "Error Webpay" };
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
