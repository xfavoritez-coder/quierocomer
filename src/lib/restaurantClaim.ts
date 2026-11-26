import { readAdminSession, signWithSessionSecret, safeEqualB64 } from "@/lib/session";

/**
 * Permiso firmado para terminar de configurar un local recién creado en
 * /agregarlocal (asignar dueño, aplicar fotos, traducir).
 *
 * /api/agregarlocal/confirm crea el local y devuelve este token; la página lo
 * reenvía en los pasos siguientes. Así esos pasos solo pueden tocar el local que
 * ese mismo navegador acaba de crear, y no cualquier local por su id (antes
 * cualquiera podía asignarse como dueño de un local ajeno).
 */

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 días para terminar el alta

function payload(restaurantId: string, exp: number): string {
  return `restaurant-claim:${restaurantId}:${exp}`;
}

export function createRestaurantClaim(restaurantId: string): string | null {
  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const sig = signWithSessionSecret(payload(restaurantId, exp));
  return sig ? `${exp}.${sig.toString("base64url")}` : null;
}

export function verifyRestaurantClaim(restaurantId: string, token: unknown): boolean {
  if (typeof token !== "string" || !restaurantId || token.length > 200) return false;
  const [expStr, sig, extra] = token.split(".");
  if (!expStr || !sig || extra !== undefined || !/^\d+$/.test(expStr)) return false;
  const exp = Number(expStr);
  if (exp * 1000 <= Date.now()) return false;
  const expected = signWithSessionSecret(payload(restaurantId, exp));
  return !!expected && safeEqualB64(sig, expected);
}

/** Superadmin (sesión /admin firmada) o permiso válido para ese local. */
export function canSetupRestaurant(
  req: { cookies: { get(name: string): { value: string } | undefined } },
  restaurantId: string,
  claim: unknown,
): boolean {
  if (readAdminSession(req)?.role === "SUPERADMIN") return true;
  return verifyRestaurantClaim(restaurantId, claim);
}
