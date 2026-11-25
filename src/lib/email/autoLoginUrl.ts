import crypto from "crypto";
import { secretFor } from "@/lib/session";

function getAutoLoginSecret(): string | null {
  return secretFor(process.env.AUTO_LOGIN_SECRET, "auto-login", "qc-auto-login-secret-2026");
}

function sigFor(secret: string, ownerId: string, t: string): string {
  return crypto.createHmac("sha256", secret).update(`${ownerId}:${t}`).digest("hex").slice(0, 16);
}

/** Generate a signed auto-login URL for an owner */
export function buildAutoLoginUrl(baseUrl: string, ownerId: string): string {
  const secret = getAutoLoginSecret();
  if (!secret) return `${baseUrl}/panel/login`;
  const t = Date.now().toString();
  return `${baseUrl}/api/panel/auto-login?oid=${ownerId}&sig=${sigFor(secret, ownerId, t)}&t=${t}`;
}

/** Verifica la firma de un enlace de auto-login (comparación en tiempo constante). */
export function verifyAutoLoginSig(ownerId: string, t: string, sig: string): boolean {
  const secret = getAutoLoginSecret();
  if (!secret) return false;
  const expected = Buffer.from(sigFor(secret, ownerId, t));
  const given = Buffer.from(sig);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
