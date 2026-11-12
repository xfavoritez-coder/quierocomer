// ═══════════════════════════════════════════════════════════
//  Verificación de webhooks de SharkPOS (Standard Webhooks).
//  Firma HMAC-SHA256 sobre "{webhook-id}.{webhook-timestamp}.{cuerpo CRUDO}".
//  Se verifica SIEMPRE sobre el raw body, antes de parsear el JSON.
//  Secret: SHARKPOS_WEBHOOK_SECRET (formato "whsec_<base64>"), backend-only.
// ═══════════════════════════════════════════════════════════
import crypto from "crypto";

const TOLERANCE_SEC = 5 * 60; // rechaza timestamps a más de 5 min

export interface VerifyResult {
  ok: boolean;
  reason?: string;
}

export function verifySharkposSignature(rawBody: string, headers: Headers): VerifyResult {
  const secret = process.env.SHARKPOS_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: "SHARKPOS_WEBHOOK_SECRET no configurada" };

  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return { ok: false, reason: "faltan headers de firma" };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "timestamp inválido" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsNum) > TOLERANCE_SEC) return { ok: false, reason: "timestamp fuera de tolerancia" };

  // Clave = base64 tras el prefijo "whsec_" (si lo trae).
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let key: Buffer;
  try {
    key = Buffer.from(rawSecret, "base64");
  } catch {
    return { ok: false, reason: "secret con formato inválido" };
  }

  const signedContent = `${id}.${tsNum}.${rawBody}`;
  const expected = crypto.createHmac("sha256", key).update(signedContent, "utf8").digest("base64");

  // El header trae una lista separada por espacios de "v1,<firma>". Basta que una coincida.
  const passed = sigHeader.split(" ").some((part) => {
    const comma = part.indexOf(",");
    const sig = comma >= 0 ? part.slice(comma + 1) : part;
    if (!sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });

  return passed ? { ok: true } : { ok: false, reason: "firma no coincide" };
}
