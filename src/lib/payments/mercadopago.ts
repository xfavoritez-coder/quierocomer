// ═══════════════════════════════════════════════════════════
//  MercadoPago — Checkout Pro (preferencia + redirección).
//  Credenciales por restaurante desde ecommerceConfig.mercadopago.
// ═══════════════════════════════════════════════════════════
import { parseEcommerceConfig } from "@/lib/ecommerce/config";

const MP_API = "https://api.mercadopago.com";

export interface MpSettings {
  env?: "sandbox" | "production";
  accessToken?: string;
}

/** Lee las credenciales de MercadoPago del restaurante. */
export function mercadopagoSettingsFor(restaurant: { ecommerceConfig?: unknown } | null): MpSettings {
  const m = parseEcommerceConfig(restaurant?.ecommerceConfig).mercadopago || {};
  return { env: m.env === "production" ? "production" : "sandbox", accessToken: m.accessToken };
}

export interface MpPrefResult {
  ok: boolean;
  redirectUrl?: string;
  preferenceId?: string;
  error?: string;
}

/** Crea una preferencia de Checkout Pro y devuelve la URL de pago. */
export async function mpCreatePreference(
  opts: {
    title: string;
    amount: number;
    email?: string;
    externalReference: string;
    successUrl: string;
    failureUrl: string;
    pendingUrl: string;
    notificationUrl: string;
    autoReturn?: boolean; // solo con back_urls https válidas
  },
  settings: MpSettings,
): Promise<MpPrefResult> {
  const token = settings.accessToken || "";
  if (!token) return { ok: false, error: "MercadoPago no configurado" };

  const body: Record<string, unknown> = {
    items: [{ title: opts.title, quantity: 1, unit_price: Math.round(opts.amount), currency_id: "CLP" }],
    external_reference: opts.externalReference,
    back_urls: { success: opts.successUrl, failure: opts.failureUrl, pending: opts.pendingUrl },
    notification_url: opts.notificationUrl,
    ...(opts.email ? { payer: { email: opts.email } } : {}),
    ...(opts.autoReturn ? { auto_return: "approved" } : {}),
  };

  try {
    const res = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    const d = data as { id?: string; init_point?: string; sandbox_init_point?: string; message?: string };
    const url = settings.env === "production" ? d.init_point : d.sandbox_init_point || d.init_point;
    if (d.id && url) return { ok: true, redirectUrl: url, preferenceId: d.id };
    return { ok: false, error: d.message ?? "Error MercadoPago" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error MercadoPago" };
  }
}

export interface MpPaymentResult {
  ok: boolean;
  paid: boolean;
  externalReference?: string;
  raw?: unknown;
  error?: string;
}

/** Consulta un pago. status === "approved" → pagado. */
export async function mpGetPayment(paymentId: string, settings: MpSettings): Promise<MpPaymentResult> {
  const token = settings.accessToken || "";
  if (!token) return { ok: false, paid: false, error: "MercadoPago no configurado" };
  try {
    const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    const d = data as { status?: string; external_reference?: string };
    return { ok: true, paid: d.status === "approved", externalReference: d.external_reference, raw: data };
  } catch (err) {
    return { ok: false, paid: false, error: err instanceof Error ? err.message : "Error MercadoPago" };
  }
}
