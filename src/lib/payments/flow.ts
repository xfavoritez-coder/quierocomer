// ═══════════════════════════════════════════════════════════
//  Flow.cl — integración (portado de Servio).
//  Credenciales por restaurante desde ecommerceConfig.flow.
// ═══════════════════════════════════════════════════════════
import crypto from "crypto";
import { parseEcommerceConfig } from "@/lib/ecommerce/config";

const FLOW_SANDBOX = "https://sandbox.flow.cl/api";
const FLOW_PROD = "https://www.flow.cl/api";

export interface FlowSettings {
  env?: "sandbox" | "production";
  apiKey?: string;
  secretKey?: string;
}

/** Lee las credenciales de Flow del restaurante. */
export function flowSettingsFor(restaurant: { ecommerceConfig?: unknown } | null): FlowSettings {
  const f = parseEcommerceConfig(restaurant?.ecommerceConfig).flow || {};
  return { env: f.env === "production" ? "production" : "sandbox", apiKey: f.apiKey, secretKey: f.secretKey };
}

/** Firma HMAC-SHA256 de los params (ordenados key+value concatenados). */
function sign(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params).sort().map((k) => k + params[k]).join("");
  return crypto.createHmac("sha256", secret).update(sorted).digest("hex");
}

export interface FlowInitResult {
  ok: boolean;
  redirectUrl?: string;
  flowOrder?: number;
  token?: string;
  error?: string;
}

export interface FlowStatusResult {
  ok: boolean;
  paid: boolean;
  amount?: number;
  raw?: unknown;
  error?: string;
}

/** Crea el pago en Flow y devuelve la URL a la que redirigir al cliente. */
export async function flowInit(
  commerceOrder: string,
  subject: string,
  amount: number,
  email: string,
  urlConfirmation: string,
  urlReturn: string,
  settings: FlowSettings,
): Promise<FlowInitResult> {
  const base = settings.env === "production" ? FLOW_PROD : FLOW_SANDBOX;
  const apiKey = settings.apiKey || "";
  const secret = settings.secretKey || "";
  if (!apiKey || !secret) return { ok: false, error: "Flow no configurado" };

  const params: Record<string, string> = {
    apiKey,
    commerceOrder,
    subject,
    amount: String(Math.round(amount)),
    email,
    urlConfirmation,
    urlReturn,
    currency: "CLP",
    paymentMethod: "9", // todos los medios
  };
  params.s = sign(params, secret);

  try {
    const res = await fetch(`${base}/payment/create`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params).toString(),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    const d = data as { url?: string; token?: string; flowOrder?: number; message?: string };
    if (d.url && d.token) {
      return { ok: true, redirectUrl: `${d.url}?token=${d.token}`, token: d.token, flowOrder: d.flowOrder };
    }
    return { ok: false, error: d.message ?? "Error Flow" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error Flow" };
  }
}

/** Consulta el estado de un pago de Flow. status === 2 → pagado. */
export async function flowGetStatus(token: string, settings: FlowSettings): Promise<FlowStatusResult> {
  const base = settings.env === "production" ? FLOW_PROD : FLOW_SANDBOX;
  const apiKey = settings.apiKey || "";
  const secret = settings.secretKey || "";
  if (!apiKey || !secret) return { ok: false, paid: false, error: "Flow no configurado" };

  const params: Record<string, string> = { apiKey, token };
  params.s = sign(params, secret);

  try {
    const res = await fetch(`${base}/payment/getStatus?${new URLSearchParams(params).toString()}`);
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    const d = data as { status?: number; amount?: number };
    return { ok: true, paid: d.status === 2, amount: d.amount, raw: data };
  } catch (err) {
    return { ok: false, paid: false, error: err instanceof Error ? err.message : "Error Flow" };
  }
}
