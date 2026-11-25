import crypto from "crypto";
import { secretFor } from "@/lib/session";

function getMagicSecret(): string | null {
  return secretFor(process.env.MAGIC_LINK_SECRET, "magic-link", "fallback-dev-secret-change-in-prod");
}

const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

export function createPanelMagicToken(ownerId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ id: ownerId, exp: Date.now() + EXPIRY_MS })
  ).toString("base64url");
  const secret = getMagicSecret();
  // Sin secreto en producción: token inválido (el enlace llevará al login).
  if (!secret) return "invalid";
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyPanelMagicToken(token: string): { id: string } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot < 0) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const secret = getMagicSecret();
    if (!secret) return null;
    const expected = Buffer.from(crypto.createHmac("sha256", secret).update(payload).digest("base64url"));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!data.id || !data.exp || Date.now() > data.exp) return null;
    return { id: data.id };
  } catch {
    return null;
  }
}
