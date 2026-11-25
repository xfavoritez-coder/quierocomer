import { signWithSessionSecret, safeEqualB64 } from "@/lib/session";

/**
 * Enlaces firmados para entrar al panel de un local desde correos/WhatsApp
 * (/api/panel/demo-auth?slug=...&k=...).
 *
 * Antes bastaba con conocer el slug (que es público) para entrar como el dueño.
 * Ahora el enlace lleva una firma con vencimiento; sin ella, demo-auth no entrega
 * la sesión del dueño.
 */

const DEFAULT_TTL_DAYS = 30;

function payload(slug: string, exp: number): string {
  return `panel-entry:${slug}:${exp}`;
}

/** Token "exp.firma". null si no hay SESSION_SECRET. */
export function createPanelEntryToken(slug: string, ttlDays = DEFAULT_TTL_DAYS): string | null {
  const exp = Math.floor(Date.now() / 1000) + ttlDays * 24 * 60 * 60;
  const sig = signWithSessionSecret(payload(slug, exp));
  return sig ? `${exp}.${sig.toString("base64url")}` : null;
}

export function verifyPanelEntryToken(slug: string, token: string | null | undefined): boolean {
  if (!token || token.length > 200) return false;
  const [expStr, sig, extra] = token.split(".");
  if (!expStr || !sig || extra !== undefined || !/^\d+$/.test(expStr)) return false;
  const exp = Number(expStr);
  if (exp * 1000 <= Date.now()) return false;
  const expected = signWithSessionSecret(payload(slug, exp));
  return !!expected && safeEqualB64(sig, expected);
}

/**
 * URL de entrada al panel. Si no se puede firmar (falta SESSION_SECRET) devuelve
 * el enlace sin firma, que simplemente llevará al login.
 */
export function buildPanelEntryUrl(baseUrl: string, slug: string, ttlDays = DEFAULT_TTL_DAYS): string {
  const url = `${baseUrl}/api/panel/demo-auth?slug=${encodeURIComponent(slug)}`;
  const k = createPanelEntryToken(slug, ttlDays);
  return k ? `${url}&k=${encodeURIComponent(k)}` : url;
}
