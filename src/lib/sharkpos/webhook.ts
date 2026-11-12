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

/**
 * Secrets candidatas. En modo plataforma los estados del SII de TODOS los RUT
 * llegan por el webhook de partner (secret propia), mientras el piloto
 * (El Suculento) usa su webhook de RUT (secret del sandbox). Se admiten varias:
 * SHARKPOS_WEBHOOK_SECRET (piloto) + SHARKPOS_PARTNER_WEBHOOK_SECRET (plataforma),
 * y una lista opcional SHARKPOS_WEBHOOK_SECRETS separada por comas.
 */
function candidateSecrets(): string[] {
  const out: string[] = [];
  const add = (v?: string | null) => { if (v && v.trim()) out.push(v.trim()); };
  add(process.env.SHARKPOS_WEBHOOK_SECRET);
  add(process.env.SHARKPOS_PARTNER_WEBHOOK_SECRET);
  for (const s of (process.env.SHARKPOS_WEBHOOK_SECRETS || "").split(",")) add(s);
  return [...new Set(out)];
}

export function verifySharkposSignature(rawBody: string, headers: Headers): VerifyResult {
  const secrets = candidateSecrets();
  if (!secrets.length) return { ok: false, reason: "SHARKPOS_WEBHOOK_SECRET no configurada" };

  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return { ok: false, reason: "faltan headers de firma" };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "timestamp inválido" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsNum) > TOLERANCE_SEC) return { ok: false, reason: "timestamp fuera de tolerancia" };

  const signedContent = `${id}.${tsNum}.${rawBody}`;
  const sigs = sigHeader.split(" ").map((part) => { const c = part.indexOf(","); return (c >= 0 ? part.slice(c + 1) : part).trim(); }).filter(Boolean);

  // Basta que ALGUNA secret produzca una firma que coincida con alguna del header.
  for (const secret of secrets) {
    const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
    let key: Buffer;
    try { key = Buffer.from(rawSecret, "base64"); } catch { continue; }
    const expected = crypto.createHmac("sha256", key).update(signedContent, "utf8").digest("base64");
    const b = Buffer.from(expected);
    const passed = sigs.some((sig) => { const a = Buffer.from(sig); return a.length === b.length && crypto.timingSafeEqual(a, b); });
    if (passed) return { ok: true };
  }
  return { ok: false, reason: "firma no coincide" };
}
