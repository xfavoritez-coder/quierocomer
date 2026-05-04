/**
 * Flow.cl client.
 *
 * Flow autentica cada request con HMAC-SHA256 sobre los params ordenados
 * alfabeticamente como key1=value1key2=value2... usando la secret key.
 * Docs: https://www.flow.cl/docs/api.html
 */
import crypto from "crypto";

function getCreds() {
  const apiKey = process.env.FLOW_API_KEY;
  const secret = process.env.FLOW_SECRET_KEY;
  const base = process.env.FLOW_API_URL || "https://sandbox.flow.cl/api";
  if (!apiKey || !secret) {
    throw new Error("FLOW_API_KEY o FLOW_SECRET_KEY no estan definidas");
  }
  return { apiKey, secret, base };
}

type FlowParams = Record<string, string | number | boolean | undefined | null>;

function buildSignedBody(params: FlowParams, apiKey: string, secret: string): URLSearchParams {
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    clean[k] = String(v);
  }
  clean.apiKey = apiKey;

  // firma: concatenar key=value ordenado alfabeticamente, sin separadores
  const sorted = Object.keys(clean).sort();
  const toSign = sorted.map((k) => `${k}=${clean[k]}`).join("&");
  const signature = crypto.createHmac("sha256", secret).update(toSign).digest("hex");

  const body = new URLSearchParams();
  for (const k of sorted) body.set(k, clean[k]);
  body.set("s", signature);
  return body;
}

export async function flowPost<T = any>(endpoint: string, params: FlowParams = {}): Promise<T> {
  const { apiKey, secret, base } = getCreds();
  const body = buildSignedBody(params, apiKey, secret);
  const url = `${base}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Flow ${endpoint} ${res.status}: ${data?.message || text}`);
    (err as any).code = data?.code;
    (err as any).status = res.status;
    throw err;
  }
  return data as T;
}

export async function flowGet<T = any>(endpoint: string, params: FlowParams = {}): Promise<T> {
  const { apiKey, secret, base } = getCreds();
  const body = buildSignedBody(params, apiKey, secret);
  const url = `${base}${endpoint}?${body.toString()}`;
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Flow ${endpoint} ${res.status}: ${data?.message || text}`);
    (err as any).code = data?.code;
    (err as any).status = res.status;
    throw err;
  }
  return data as T;
}

/**
 * Verifica la firma de un callback de Flow. Flow envia "s" en el body con
 * la firma de los demas params; reconstruimos y comparamos.
 */
export function verifyFlowSignature(params: Record<string, string>): boolean {
  const { secret } = getCreds();
  const { s, ...rest } = params;
  if (!s) return false;
  const sorted = Object.keys(rest).sort();
  const toSign = sorted.map((k) => `${k}=${rest[k]}`).join("&");
  const expected = crypto.createHmac("sha256", secret).update(toSign).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(s, "hex"));
}
